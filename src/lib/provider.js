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

export async function callGemini({ key, model, system, user, fetchImpl = fetch }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      // 생각(thinking) 토큰도 출력 한도에 들어가는 모델이 있어 넉넉히 둔다
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 },
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

export async function runBatch({ getState, pseudoIds, section, opts, onResult, onStatus = () => {}, signal, deps = {} }) {
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const done = [];
  for (let i = 0; i < pseudoIds.length; i++) {
    const pid = pseudoIds[i];
    if (signal?.aborted) return { done, pausedAt: pid };
    let attempt = 0;
    for (;;) {
      attempt += 1;
      try {
        onStatus(`${i + 1} / ${pseudoIds.length} 쓰는 중`);
        const result = await generateOne(getState(), pid, section, opts, deps);
        onResult(pid, result);
        done.push(pid);
        break;
      } catch (err) {
        if (isFatal(err)) {
          onStatus(`API 키나 모델 이름을 확인해 주세요 (${err.status}: ${err.message})`);
          return { done, pausedAt: pid };
        }
        if (attempt >= MAX_TRIES) {
          onStatus(`여러 번 실패해서 멈췄어요. 잠시 뒤 [이어서 하기]를 눌러 주세요. (${err.message})`);
          return { done, pausedAt: pid };
        }
        const wait = retryDelayMs(err, attempt);
        onStatus(err.status === 429
          ? `무료 사용량 한도에 걸렸어요. ${Math.round(wait / 1000)}초 기다렸다가 이어 갈게요.`
          : `연결이 불안정해요. ${Math.round(wait / 1000)}초 뒤 다시 해 볼게요.`);
        await sleep(wait);
        if (signal?.aborted) return { done, pausedAt: pid };
      }
    }
    if (i < pseudoIds.length - 1) await sleep(MIN_GAP_MS);
  }
  return { done, pausedAt: null };
}
