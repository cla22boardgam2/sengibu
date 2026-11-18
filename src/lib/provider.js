// AI 호출은 이 파일에만 있다. 다른 AI로 바꿀 때는 callGemini만 바꾸면 된다.
//
// 확인한 사실 (2026-11-17, https://ai.google.dev/gemini-api/docs):
// - REST: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
//   헤더 x-goog-api-key, 본문 { systemInstruction, contents, generationConfig.responseMimeType }
//   응답 candidates[0].content.parts[].text
// - 가격표(docs/pricing): Gemini 2.5 Flash-Lite, Gemini 3 Flash Preview 모두 Free Tier "Free of charge",
//   무료 등급 입력은 "Used to improve our products: Yes"
// - 무료 등급 분당 한도는 문서에 숫자가 없어(AI Studio 화면에서만 보임) 보수적으로 간격을 둔다.
import { buildSystemPrompt, buildUserText } from "./sengibu-prompt.js";
import { buildRequest } from "./materials.js";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
export const MODEL_SUGGESTIONS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-3-flash-preview"];
export const MIN_GAP_MS = 4500;
const MAX_TRIES = 3;
const NOT_JSON = "응답이 JSON 형식이 아님 — 직접 확인 필요";

export const COPY_HEADER = "아래 지침과 자료에 따라 작성해 주세요. 답은 JSON만 출력해 주세요.\n\n";

export function emptyResult(pseudoId, section) {
  return {
    student_id: pseudoId,
    section,
    draft: "[보충 필요: 관찰 기록 없음]",
    evidence: [],
    warnings: [],
    missing: ["관찰 기록을 먼저 입력하세요."],
  };
}

function tryJSON(text) {
  try { return JSON.parse(text); } catch { return null; }
}

export function parseDraftResponse(raw, pseudoId, section) {
  const text = String(raw ?? "").trim();
  const stripped = text.replace(/^```(?:json)?\s*|\s*```$/g, "");
  let obj = tryJSON(stripped);
  if (!obj) {
    const a = text.indexOf("{");
    const b = text.lastIndexOf("}");
    if (a !== -1 && b > a) obj = tryJSON(text.slice(a, b + 1));
  }
  if (!obj || typeof obj !== "object" || typeof obj.draft !== "string") {
    return { student_id: pseudoId, section, draft: text, evidence: [], warnings: [NOT_JSON], missing: [], idMismatch: false };
  }
  const arr = (v) => (Array.isArray(v) ? v : []);
  return {
    student_id: obj.student_id ?? pseudoId,
    section: obj.section ?? section,
    draft: obj.draft,
    evidence: arr(obj.evidence),
    warnings: arr(obj.warnings),
    missing: arr(obj.missing),
    idMismatch: obj.student_id != null && obj.student_id !== pseudoId,
  };
}

// 요청서 generateDraft와 같은 구성: system = 항목 지침, user = 첨부 자료 + 학생 요청
export function promptParts(req) {
  const system = buildSystemPrompt(req.section, req.opts);
  const attach = `[첨부: 2026학년도 학교생활기록부 기재요령(초등학교) 발췌]\n${req.guideText}\n\n[첨부: 참고 자료]\n${req.extraDocs || "없음"}`;
  const user = `${attach}\n\n${buildUserText(req.section, req.opts, req.student)}`;
  return { system, user };
}

export function buildCopyPrompt(req) {
  const { system, user } = promptParts(req);
  return `${COPY_HEADER}${system}\n\n---\n\n${user}`;
}

export async function callGemini({ key, model, system, user, fetchImpl = fetch, maxOutputTokens = 8192 }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      // 생각(thinking) 토큰도 출력 한도에 들어가는 모델이 있어 넉넉히 둔다
      generationConfig: { responseMimeType: "application/json", maxOutputTokens },
    }),
  });
  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch { /* 본문 없음 */ }
    const err = new Error(body?.error?.message || `Gemini 오류 ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
}

export async function generateOne(state, pseudoId, section, opts, deps = {}) {
  const req = buildRequest(state, pseudoId, section, opts);
  if (req.empty) return { ...emptyResult(pseudoId, section), idMismatch: false, scrubbed: 0 };
  const { system, user } = promptParts(req);
  const raw = await callGemini({
    key: state.settings.geminiKey,
    model: state.settings.geminiModel?.trim() || DEFAULT_GEMINI_MODEL,
    system,
    user,
    fetchImpl: deps.fetchImpl ?? ((...a) => fetch(...a)),
  });
  return { ...parseDraftResponse(raw, pseudoId, section), scrubbed: req.scrubbed };
}

// 오류 본문의 RetryInfo("20s")를 읽고, 없으면 20초·40초
function retryDelayMs(err, attempt) {
  const details = err?.body?.error?.details || [];
  for (const d of details) {
    const m = /^(\d+(?:\.\d+)?)s$/.exec(d?.retryDelay || "");
    if (m) return Math.ceil(Number(m[1]) * 1000) + 1000;
  }
  return attempt === 1 ? 20000 : 40000;
}

const isFatal = (err) => [400, 401, 403, 404].includes(err?.status);

// groupSize > 1 이면 여러 학생을 한 요청으로 보낸다(무료 한도의 요청 횟수를 아낀다).
// 돌려주는 값: done(쓴 학생), pausedAt(멈춘 학생), remaining(이어서 할 학생)
export async function runBatch({ getState, pseudoIds, section, opts, onResult, onStatus = () => {}, signal, deps = {}, groupSize = 1 }) {
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const total = pseudoIds.length;
  const done = [];
  const queue = [...pseudoIds];
  const retried = new Set();
  const failed = [];
  const stop = (pid, rest) => ({ done, pausedAt: pid, remaining: [...rest, ...failed] });

  while (queue.length) {
    const group = queue.slice(0, Math.max(1, groupSize));
    if (signal?.aborted) return stop(group[0], queue);
    let attempt = 0;
    for (;;) {
      attempt += 1;
      try {
        if (groupSize <= 1) {
          onStatus(`${done.length + 1} / ${total} 쓰는 중`);
          const result = await generateOne(getState(), group[0], section, opts, deps);
          onResult(group[0], result);
          done.push(group[0]);
        } else {
          onStatus(`${done.length + 1}~${Math.min(total, done.length + group.length)} / ${total} 쓰는 중 (${group.length}명 한 번에)`);
          const { results, missing } = await generateGroup(getState(), group, section, opts, deps);
          for (const pid of group) if (results[pid]) { onResult(pid, results[pid]); done.push(pid); }
          for (const pid of missing) {
            if (retried.has(pid)) failed.push(pid);
            else { retried.add(pid); queue.push(pid); }
          }
        }
        queue.splice(0, group.length);
        break;
      } catch (err) {
        if (isFatal(err)) {
          onStatus(`API 키나 모델 이름을 확인해 주세요 (${err.status}: ${err.message})`);
          return stop(group[0], queue);
        }
        if (attempt >= MAX_TRIES) {
          onStatus(err.badAnswer
            ? `AI 답을 읽지 못해 멈췄어요. 한 번에 쓰는 학생 수를 줄여 [이어서 하기]를 눌러 주세요.`
            : `여러 번 실패해서 멈췄어요. 잠시 뒤 [이어서 하기]를 눌러 주세요. (${err.message})`);
          return stop(group[0], queue);
        }
        const wait = err.badAnswer ? 0 : retryDelayMs(err, attempt);
        onStatus(err.status === 429
          ? `무료 사용량 한도에 걸렸어요. ${Math.round(wait / 1000)}초 기다렸다가 이어 갈게요.`
          : err.badAnswer ? "AI 답이 잘렸거나 형식이 달라 다시 받아요."
          : `연결이 불안정해요. ${Math.round(wait / 1000)}초 뒤 다시 해 볼게요.`);
        if (wait) await sleep(wait);
        if (signal?.aborted) return stop(group[0], queue);
      }
    }
    if (queue.length) await sleep(MIN_GAP_MS);
  }
  if (failed.length) {
    onStatus(`AI 답에 빠진 학생이 있어 멈췄어요. [이어서 하기]로 다시 써 주세요.`);
    return { done, pausedAt: failed[0], remaining: failed };
  }
  return { done, pausedAt: null, remaining: [] };
}

// ── 여러 명 한 번에 (복사·붙여넣기 방식) ──
// 프롬프트 본문(COMMON_PROMPT·SECTION_RULES)은 그대로 쓰고, 여러 학생을 한 번에 보내는 포장만 더한다.
// 같은 항목이므로 지침과 첨부(기재요령·참고 자료)는 한 번만 넣는다.
export function batchHeader(n) {
  return `아래 지침과 자료에 따라 학생 ${n}명의 초안을 각각 작성해 주세요.
- 학생마다 지침의 출력 형식(JSON 객체)을 따르고, 전체 답은 하나의 JSON 배열 [ {...}, {...} ] 로만 출력해 주세요.
- 배열 순서는 학생 순서와 같게 하고, student_id에는 각 학생의 [학생 ID]를 그대로 써 주세요.
- 같은 반 학생들이니 학생끼리 시작 표현, 문장 구조, 문장 끝맺음이 겹치지 않게 써 주세요.

`;
}

function batchBody(reqs) {
  const first = reqs[0];
  const attach = `[첨부: 2026학년도 학교생활기록부 기재요령(초등학교) 발췌]\n${first.guideText}\n\n[첨부: 참고 자료]\n${first.extraDocs || "없음"}`;
  const blocks = reqs.map((r, i) => `=== 학생 ${i + 1} / ${reqs.length} ===\n${buildUserText(r.section, r.opts, r.student)}`);
  return `${attach}\n\n${blocks.join("\n\n")}`;
}

export function buildBatchCopyPrompt(reqs) {
  const system = buildSystemPrompt(reqs[0].section, reqs[0].opts);
  return `${batchHeader(reqs.length)}${system}\n\n---\n\n${batchBody(reqs)}`;
}

// API로 여러 명을 한 요청에: 지침은 시스템에 그대로, 묶음 안내와 학생 블록은 본문에
export async function generateGroup(state, pseudoIds, section, opts, deps = {}) {
  const results = {};
  const reqs = [];
  for (const pid of pseudoIds) {
    const req = buildRequest(state, pid, section, opts);
    if (req.empty) results[pid] = { ...emptyResult(pid, section), idMismatch: false, scrubbed: 0 };
    else reqs.push(req);
  }
  if (reqs.length === 0) return { results, missing: [] };
  const raw = await callGemini({
    key: state.settings.geminiKey,
    model: state.settings.geminiModel?.trim() || DEFAULT_GEMINI_MODEL,
    system: buildSystemPrompt(section, reqs[0].opts),
    user: `${batchHeader(reqs.length)}${batchBody(reqs)}`,
    fetchImpl: deps.fetchImpl ?? ((...a) => fetch(...a)),
    maxOutputTokens: 32768,
  });
  const ids = reqs.map((r) => r.student.pseudoId);
  const out = parseBatchResponse(raw, ids, section);
  if (!out.ok) {
    const err = new Error("AI 답을 JSON으로 읽지 못했어요");
    err.badAnswer = true;
    throw err;
  }
  for (const r of reqs) {
    const res = out.results[r.student.pseudoId];
    if (res) results[r.student.pseudoId] = { ...res, scrubbed: r.scrubbed };
  }
  return { results, missing: ids.filter((id) => !out.results[id]) };
}

function extractItems(raw) {
  const text = String(raw ?? "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  let v = tryJSON(text);
  if (v == null) {
    const a = text.indexOf("[");
    const b = text.lastIndexOf("]");
    if (a !== -1 && b > a) v = tryJSON(text.slice(a, b + 1));
  }
  if (v == null) {
    const a = text.indexOf("{");
    const b = text.lastIndexOf("}");
    if (a !== -1 && b > a) v = tryJSON(text.slice(a, b + 1));
  }
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") return Array.isArray(v.results) ? v.results : [v];
  return null;
}

// 답을 학생 ID로 나눈다. results: {pid: 결과}, missing: 답이 없는 학생, unknown: 목록에 없는 ID
export function parseBatchResponse(raw, pseudoIds, section) {
  const items = extractItems(raw);
  if (!items) return { ok: false, results: {}, missing: [...pseudoIds], unknown: [] };
  const results = {};
  const unknown = [];
  for (const it of items) {
    if (!it || typeof it !== "object" || typeof it.draft !== "string") continue;
    const id = String(it.student_id ?? "");
    if (!pseudoIds.includes(id)) { unknown.push(id || "(ID 없음)"); continue; }
    if (!results[id]) results[id] = parseDraftResponse(JSON.stringify(it), id, section);
  }
  return { ok: true, results, missing: pseudoIds.filter((p) => !results[p]), unknown };
}
