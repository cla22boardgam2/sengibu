import { emptyState } from "../src/lib/defaults.js";
import { addStudents } from "../src/lib/students.js";
import {
  parseDraftResponse, emptyResult, promptParts, buildCopyPrompt, COPY_HEADER,
  callGemini, generateOne, runBatch, DEFAULT_GEMINI_MODEL, buildBatchCopyPrompt, parseBatchResponse,
} from "../src/lib/provider.js";
import { buildRequest } from "../src/lib/materials.js";

function state() {
  const s = addStudents(emptyState(), ["김지수", "박민", "이하늘"]);
  s.settings.guideText = "행발은 1500바이트 이내";
  s.settings.geminiKey = "test-key";
  const id = s.chips.C.find((c) => c.text === "손을 들어 자기 생각을 자주 발표함").id;
  for (const p of ["S01", "S02", "S03"]) s.inputs[p] = { chipsC: { [id]: "2026-11-17" } };
  return s;
}

const geminiReply = (obj) => ({
  ok: true, status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }),
});
const errReply = (status, body = {}) => ({ ok: false, status, json: async () => body, text: async () => JSON.stringify(body) });

describe("parseDraftResponse", () => {
  test("코드블록을 벗기고 빈 배열을 채운다", () => {
    expect(parseDraftResponse('```json\n{"student_id":"S01","draft":"가"}\n```', "S01", "C")).toMatchObject({
      draft: "가", idMismatch: false, evidence: [], warnings: [], missing: [],
    });
  });
  test("JSON이 아니면 원문을 초안으로, 경고를 단다", () => {
    expect(parseDraftResponse("그냥 글", "S01", "C")).toMatchObject({
      draft: "그냥 글", warnings: ["응답이 JSON 형식이 아님 — 직접 확인 필요"], idMismatch: false,
    });
  });
  test("다른 학생 ID면 idMismatch", () => {
    expect(parseDraftResponse('{"student_id":"S09","draft":"가"}', "S01", "C").idMismatch).toBe(true);
  });
  test("앞뒤 군말이 있어도 JSON 부분을 읽는다", () => {
    expect(parseDraftResponse('여기 있어요: {"student_id":"S01","draft":"가"} 끝', "S01", "C").draft).toBe("가");
  });
  test("draft가 문자열이 아니면 원문 취급", () => {
    expect(parseDraftResponse('{"student_id":"S01"}', "S01", "C").warnings[0]).toMatch("JSON 형식이 아님");
  });
});

test("emptyResult는 generateDraft의 기본 결과와 같다", () => {
  expect(emptyResult("S01", "C")).toEqual({
    student_id: "S01", section: "C", draft: "[보충 필요: 관찰 기록 없음]",
    evidence: [], warnings: [], missing: ["관찰 기록을 먼저 입력하세요."],
  });
});

test("promptParts와 복사 프롬프트: 시스템 지침·기재요령·가명은 있고 실명은 없다", () => {
  const req = buildRequest(state(), "S01", "C", {});
  const { system, user } = promptParts(req);
  expect(system).toContain("행동특성 및 종합의견 (행발)");
  expect(user).toContain("[첨부: 2026학년도 학교생활기록부 기재요령(초등학교) 발췌]\n행발은 1500바이트 이내");
  expect(user).toContain("[첨부: 참고 자료]\n없음");
  expect(user).toContain("[학생 ID] S01");
  const copy = buildCopyPrompt(req);
  expect(copy.startsWith(COPY_HEADER)).toBe(true);
  expect(copy).toContain(system);
  expect(copy).toContain(user);
  expect(copy).not.toMatch(/김지수|박민|이하늘/);
});

test("callGemini: 키는 헤더로, 지침·본문을 보내고 응답 글을 돌려준다", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return geminiReply({ student_id: "S01", draft: "가" }); };
  const text = await callGemini({ key: "k1", model: "m1", system: "SYS", user: "USR", fetchImpl });
  expect(JSON.parse(text).draft).toBe("가");
  expect(calls[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/models/m1:generateContent");
  expect(calls[0].url).not.toContain("k1");
  expect(calls[0].init.headers["x-goog-api-key"]).toBe("k1");
  const body = JSON.parse(calls[0].init.body);
  expect(body.systemInstruction.parts[0].text).toBe("SYS");
  expect(body.contents[0].parts[0].text).toBe("USR");
  expect(body.generationConfig.responseMimeType).toBe("application/json");
});

test("callGemini: 오류면 status가 붙은 Error", async () => {
  const fetchImpl = async () => errReply(429, { error: { message: "quota" } });
  await expect(callGemini({ key: "k", model: "m", system: "", user: "", fetchImpl })).rejects.toMatchObject({ status: 429 });
});

test("generateOne: 재료가 없으면 부르지 않고 기본 결과", async () => {
  const s = state();
  s.inputs.S01 = {};
  let n = 0;
  const r = await generateOne(s, "S01", "C", {}, { fetchImpl: async () => { n++; } });
  expect(n).toBe(0);
  expect(r.draft).toBe("[보충 필요: 관찰 기록 없음]");
});

test("generateOne: 모델 이름이 비면 기본 모델", async () => {
  let url = "";
  await generateOne(state(), "S01", "C", {}, { fetchImpl: async (u) => { url = u; return geminiReply({ student_id: "S01", draft: "가" }); } });
  expect(url).toContain(`/models/${DEFAULT_GEMINI_MODEL}:generateContent`);
});

describe("runBatch", () => {
  function harness(replies) {
    let s = state();
    const results = {};
    const sent = [];
    const fetchImpl = async (url, init) => {
      sent.push(JSON.parse(init.body).contents[0].parts[0].text);
      const r = replies.shift();
      if (r instanceof Error) throw r;
      return r;
    };
    const onResult = (pid, res) => {
      results[pid] = res;
      s = { ...s, drafts: { ...s.drafts, [pid]: { C: { draft: res.draft } } } };
    };
    return { getState: () => s, results, sent, fetchImpl, onResult };
  }

  test("429 한 번은 기다렸다가 같은 학생부터 다시 하고, 앞 학생 첫 어절을 다음 요청에 넣는다", async () => {
    const h = harness([
      geminiReply({ student_id: "S01", draft: "발표를 즐김." }),
      errReply(429),
      geminiReply({ student_id: "S02", draft: "수업에서 발표함." }),
      geminiReply({ student_id: "S03", draft: "모둠에서 발표함." }),
    ]);
    const waits = [];
    const out = await runBatch({
      getState: h.getState, pseudoIds: ["S01", "S02", "S03"], section: "C", opts: {},
      onResult: h.onResult, onStatus: () => {}, deps: { fetchImpl: h.fetchImpl, sleep: async (ms) => waits.push(ms) },
    });
    expect(out).toMatchObject({ done: ["S01", "S02", "S03"], pausedAt: null });
    expect(waits).toContain(20000);
    expect(h.sent[1]).toContain("[같은 반 기존 초안의 시작 표현] 발표를\n");
    expect(h.sent[3]).toContain("[같은 반 기존 초안의 시작 표현] 발표를, 수업에서\n");
  });

  test("같은 학생이 3번 연속 실패하면 그 학생에서 멈추고 앞 결과는 이미 전달됨", async () => {
    const h = harness([geminiReply({ student_id: "S01", draft: "가" }), errReply(500), errReply(503), new Error("network")]);
    const out = await runBatch({
      getState: h.getState, pseudoIds: ["S01", "S02", "S03"], section: "C", opts: {},
      onResult: h.onResult, onStatus: () => {}, deps: { fetchImpl: h.fetchImpl, sleep: async () => {} },
    });
    expect(out).toMatchObject({ done: ["S01"], pausedAt: "S02" });
    expect(h.results.S01.draft).toBe("가");
  });

  test("키 오류(400/401/403)는 다시 시도하지 않고 바로 멈춘다", async () => {
    const h = harness([errReply(403)]);
    const msgs = [];
    const out = await runBatch({
      getState: h.getState, pseudoIds: ["S01"], section: "C", opts: {},
      onResult: h.onResult, onStatus: (m) => msgs.push(m), deps: { fetchImpl: h.fetchImpl, sleep: async () => {} },
    });
    expect(out.pausedAt).toBe("S01");
    expect(h.sent).toHaveLength(1);
    expect(msgs.join(" ")).toContain("API 키나 모델 이름을 확인해 주세요");
  });

  test("멈춤을 누르면 진행 중인 학생까지만 하고 멈춘다", async () => {
    const ctrl = new AbortController();
    const h = harness([geminiReply({ student_id: "S01", draft: "가" }), geminiReply({ student_id: "S02", draft: "나" })]);
    const out = await runBatch({
      getState: h.getState, pseudoIds: ["S01", "S02", "S03"], section: "C", opts: {}, signal: ctrl.signal,
      onResult: (pid, r) => { h.onResult(pid, r); ctrl.abort(); }, onStatus: () => {},
      deps: { fetchImpl: h.fetchImpl, sleep: async () => {} },
    });
    expect(out).toMatchObject({ done: ["S01"], pausedAt: "S02" });
  });
});

test("callGemini: 생각하는 모델에서도 답이 잘리지 않게 출력 한도를 넉넉히 둔다", async () => {
  let body;
  await callGemini({ key: "k", model: "m", system: "", user: "", fetchImpl: async (u, i) => { body = JSON.parse(i.body); return geminiReply({ draft: "가" }); } });
  expect(body.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(8192);
});

describe("여러 명 한 번에 (복사 방식)", () => {
  test("buildBatchCopyPrompt: 지침·첨부는 한 번만, 학생 블록은 순서대로, 실명은 없다", () => {
    const s = state();
    const reqs = ["S01", "S02", "S03"].map((p) => buildRequest(s, p, "C", {}));
    const text = buildBatchCopyPrompt(reqs);
    const { system } = promptParts(reqs[0]);
    expect(text.split(system).length - 1).toBe(1);
    expect(text.split("행발은 1500바이트 이내").length - 1).toBe(1);
    expect(text).toContain("학생 3명");
    expect(text).toContain("JSON 배열");
    const i1 = text.indexOf("[학생 ID] S01");
    const i3 = text.indexOf("[학생 ID] S03");
    expect(i1).toBeGreaterThan(0);
    expect(i3).toBeGreaterThan(i1);
    expect(text).toContain("=== 학생 2 / 3 ===");
    expect(text).not.toMatch(/김지수|박민|이하늘/);
  });

  test("parseBatchResponse: 코드블록 속 배열을 학생 ID로 나눠 읽는다", () => {
    const raw = '```json\n[{"student_id":"S02","draft":"나."},{"student_id":"S01","draft":"가.","evidence":[{"sentence":"가.","source":"칩"}]}]\n```';
    const out = parseBatchResponse(raw, ["S01", "S02", "S03"], "C");
    expect(out.results.S01).toMatchObject({ draft: "가.", idMismatch: false, warnings: [] });
    expect(out.results.S01.evidence).toHaveLength(1);
    expect(out.results.S02.draft).toBe("나.");
    expect(out.missing).toEqual(["S03"]);
    expect(out.unknown).toEqual([]);
    expect(out.ok).toBe(true);
  });

  test("parseBatchResponse: 앞뒤 군말, 목록에 없는 ID, 한 명짜리 객체", () => {
    const out = parseBatchResponse('네! [{"student_id":"S09","draft":"x"},{"student_id":"S01","draft":"가."}] 끝', ["S01"], "C");
    expect(out.results.S01.draft).toBe("가.");
    expect(out.unknown).toEqual(["S09"]);
    expect(parseBatchResponse('{"student_id":"S01","draft":"가."}', ["S01"], "C").results.S01.draft).toBe("가.");
  });

  test("parseBatchResponse: JSON이 아니면 ok:false", () => {
    expect(parseBatchResponse("죄송해요", ["S01"], "C")).toMatchObject({ ok: false, results: {} });
  });
});

describe("runBatch 여러 명 한 요청 (groupSize)", () => {
  function harness(replies) {
    let s = state();
    const results = {};
    const bodies = [];
    const fetchImpl = async (url, init) => {
      bodies.push(JSON.parse(init.body));
      const r = replies.shift();
      if (r instanceof Error) throw r;
      return r;
    };
    const onResult = (pid, res) => {
      results[pid] = res;
      s = { ...s, drafts: { ...s.drafts, [pid]: { C: { draft: res.draft } } } };
    };
    return { getState: () => s, results, bodies, fetchImpl, onResult };
  }
  const arr = (...ids) => geminiReply(ids.map((id) => ({ student_id: id, draft: `${id} 글.` })));

  test("학생 3명을 2명씩 묶어 2번만 부르고, 지침은 시스템에, 묶음 안내는 본문에", async () => {
    const h = harness([arr("S01", "S02"), arr("S03")]);
    const out = await runBatch({
      getState: h.getState, pseudoIds: ["S01", "S02", "S03"], section: "C", opts: {}, groupSize: 2,
      onResult: h.onResult, onStatus: () => {}, deps: { fetchImpl: h.fetchImpl, sleep: async () => {} },
    });
    expect(out).toMatchObject({ done: ["S01", "S02", "S03"], pausedAt: null, remaining: [] });
    expect(h.bodies).toHaveLength(2);
    const sys = h.bodies[0].systemInstruction.parts[0].text;
    expect(sys).toContain("행동특성 및 종합의견 (행발)");
    const user = h.bodies[0].contents[0].parts[0].text;
    expect(user).toContain("학생 2명");
    expect(user).toContain("[학생 ID] S02");
    expect(user).not.toContain("[학생 ID] S03");
    expect(user).not.toMatch(/김지수|박민|이하늘/);
    expect(h.results.S03.draft).toBe("S03 글.");
    // 두 번째 묶음은 앞 묶음 초안의 첫 어절을 피하도록 받는다
    expect(h.bodies[1].contents[0].parts[0].text).toContain("[같은 반 기존 초안의 시작 표현] S01, S02");
    expect(h.bodies[0].generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(16384);
  });

  test("답에서 빠진 학생은 맨 뒤에서 한 번 더 부르고, 그래도 없으면 그 학생들만 남기고 멈춘다", async () => {
    const h = harness([arr("S01"), geminiReply([]), ]);
    const out = await runBatch({
      getState: h.getState, pseudoIds: ["S01", "S02"], section: "C", opts: {}, groupSize: 2,
      onResult: h.onResult, onStatus: () => {}, deps: { fetchImpl: h.fetchImpl, sleep: async () => {} },
    });
    expect(h.bodies).toHaveLength(2);
    expect(h.bodies[1].contents[0].parts[0].text).toContain("[학생 ID] S02");
    expect(out).toMatchObject({ done: ["S01"], pausedAt: "S02", remaining: ["S02"] });
  });

  test("JSON이 아닌 답은 재시도 대상이고, 3번 실패하면 그 묶음에서 멈춘다", async () => {
    const bad = { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "잘린 답 [{" }] } }] }) };
    const h = harness([bad, bad, bad]);
    const msgs = [];
    const out = await runBatch({
      getState: h.getState, pseudoIds: ["S01", "S02"], section: "C", opts: {}, groupSize: 2,
      onResult: h.onResult, onStatus: (m) => msgs.push(m), deps: { fetchImpl: h.fetchImpl, sleep: async () => {} },
    });
    expect(h.bodies).toHaveLength(3);
    expect(out).toMatchObject({ done: [], pausedAt: "S01", remaining: ["S01", "S02"] });
    expect(msgs.join(" ")).toContain("한 번에 쓰는 학생 수를 줄여");
  });

  test("입력이 없는 학생은 묶음에서 빼고 보충 필요로 바로 저장", async () => {
    const h = harness([arr("S02")]);
    const s0 = h.getState();
    s0.inputs.S01 = {};
    await runBatch({
      getState: h.getState, pseudoIds: ["S01", "S02"], section: "C", opts: {}, groupSize: 2,
      onResult: h.onResult, onStatus: () => {}, deps: { fetchImpl: h.fetchImpl, sleep: async () => {} },
    });
    expect(h.bodies).toHaveLength(1);
    expect(h.bodies[0].contents[0].parts[0].text).not.toContain("[학생 ID] S01");
    expect(h.results.S01.draft).toBe("[보충 필요: 관찰 기록 없음]");
  });
});
