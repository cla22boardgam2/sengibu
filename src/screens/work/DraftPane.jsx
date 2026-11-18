import { useEffect, useState } from "react";
import { buildRequest } from "../../lib/materials.js";
import { buildCopyPrompt, parseDraftResponse, emptyResult, generateOne } from "../../lib/provider.js";
import { saveDraft, patchDraft, hasStudentId } from "../../lib/drafts.js";
import { toRealNames } from "../../lib/students.js";
import ByteCounter from "../../components/ByteCounter.jsx";
import { Button, Notice, inputCls } from "../../components/ui.jsx";

const NEED_SPLIT = /(\[보충 필요[^\]]*\]?)/;
const hasNeed = (t) => String(t ?? "").includes("[보충 필요");

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export function confirmGuide(state) {
  return state.settings.guideText.trim() || window.confirm("설정에 기재요령 발췌가 없어요. 그래도 진행할까요?");
}

function Highlighted({ text }) {
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap">
      {String(text).split(NEED_SPLIT).map((p, i) =>
        p.startsWith("[보충 필요")
          ? <mark key={i} data-testid="need-more" className="bg-red-100 text-red-700 rounded px-0.5">{p}</mark>
          : <span key={i}>{p}</span>)}
    </p>
  );
}

// 키가 있으면 한 명 바로 생성, 없으면(또는 복사 방식을 고르면) 프롬프트 복사 → 답 붙여넣기
function GenerateBox({ state, st, section, opts, keyName, update, auto, entry }) {
  const pid = st.pseudoId;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [answer, setAnswer] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  useEffect(() => { setMsg(null); setAnswer(""); setShowPrompt(false); }, [pid, keyName]);

  const req = buildRequest(state, pid, section, opts);
  const okToReplace = () => !entry?.reviewed || window.confirm("검토 완료한 초안을 새로 쓸까요?");

  if (req.empty) {
    return (
      <div className="space-y-2">
        <Notice tone="warn">이 학생은 고른 칩·등급·메모가 없어요. 가운데에서 먼저 골라 주세요.</Notice>
        {!entry && (
          <Button variant="ghost" onClick={() => update((s) => saveDraft(s, pid, keyName, { ...emptyResult(pid, section), idMismatch: false }))}>
            보충 필요로 표시하기
          </Button>
        )}
      </div>
    );
  }

  if (auto) {
    const run = async () => {
      if (!confirmGuide(state) || !okToReplace()) return;
      setBusy(true);
      setMsg(null);
      try {
        const result = await generateOne(state, pid, section, opts);
        update((s) => saveDraft(s, pid, keyName, result));
        if (result.scrubbed) setMsg({ tone: "warn", text: `실명 ${result.scrubbed}곳을 가명으로 바꿔 보냈어요.` });
      } catch (err) {
        setMsg({ tone: "error", text: err.status === 429 ? "무료 한도에 걸렸어요. 잠시 뒤 다시 눌러 주세요." : `쓰지 못했어요: ${err.message}` });
      }
      setBusy(false);
    };
    return (
      <div className="space-y-2">
        <Button onClick={run} disabled={busy}>{busy ? "쓰는 중…" : entry ? "이 학생 다시 생성" : "이 학생 생성"}</Button>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </div>
    );
  }

  const prompt = buildCopyPrompt(req);
  const copy = async () => {
    if (!confirmGuide(state)) return;
    const ok = await copyText(prompt);
    setMsg(ok ? { tone: "info", text: "복사했어요. AI 채팅 새 창에 붙여넣으세요." } : { tone: "warn", text: "자동 복사가 안 돼요. 아래 프롬프트를 직접 선택해 복사해 주세요." });
    if (!ok) setShowPrompt(true);
  };
  const save = () => {
    const result = parseDraftResponse(answer, pid, section);
    if (result.idMismatch && !window.confirm(`다른 학생(${result.student_id})의 답 같아요. 그래도 ${st.number}번에 저장할까요?`)) return;
    if (!okToReplace()) return;
    update((s) => saveDraft(s, pid, keyName, result));
    setAnswer("");
    setMsg({ tone: "info", text: "저장했어요. 위에서 확인하고 검토 완료를 눌러 주세요." });
  };
  return (
    <div className="space-y-2 border border-slate-200 rounded-lg p-3">
      <div className="text-xs text-slate-500">복사·붙여넣기로 쓰기: 프롬프트를 Claude·ChatGPT·Gemini 새 채팅에 붙여넣고, 받은 답을 아래에 넣으세요.</div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={copy}>프롬프트 복사</Button>
        <button type="button" className="text-xs underline text-slate-500" onClick={() => setShowPrompt((v) => !v)}>
          {showPrompt ? "프롬프트 접기" : "프롬프트 보기"}
        </button>
      </div>
      {req.scrubbed > 0 && <Notice tone="warn">실명 {req.scrubbed}곳을 가명으로 바꿔 복사해요.</Notice>}
      {showPrompt && <textarea readOnly className={`${inputCls} h-32 font-mono text-xs`} value={prompt} aria-label="프롬프트" />}
      <textarea aria-label="답 붙여넣기" className={`${inputCls} h-20`} placeholder="AI가 준 답(JSON)을 그대로 붙여넣으세요"
        value={answer} onChange={(e) => setAnswer(e.target.value)} />
      <div className="flex justify-end"><Button onClick={save} disabled={!answer.trim()}>답 저장</Button></div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </div>
  );
}

export default function DraftPane({ state, st, section, opts, keyName, update, auto }) {
  const pid = st.pseudoId;
  const entry = state.drafts[pid]?.[keyName];
  const [note, setNote] = useState("");
  useEffect(() => setNote(""), [pid, keyName]);
  const shown = entry ? toRealNames(entry.draft, state.students) : "";

  // 고친 글은 보이는 그대로 저장한다 (다시 가명으로 바꾸면 "한결같이" 같은 낱말이 망가진다).
  const edit = (value) => update((s) => patchDraft(s, pid, keyName, { draft: value, reviewed: false }));
  const copy = async () => setNote((await copyText(shown)) ? "복사했어요." : "복사가 안 돼요. 초안 칸에서 직접 복사해 주세요.");

  return (
    <section aria-label={`${st.number}번 학생 초안`} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-800">초안</h2>
        {entry && <ByteCounter text={shown} state={state} section={section} />}
      </div>

      {entry ? (
        <div>
          <textarea aria-label="초안" value={shown} onChange={(e) => edit(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm h-40 focus:outline-none focus:ring-2 focus:ring-indigo-600" />
          {hasNeed(entry.draft) && <div className="mt-1 border border-red-200 rounded-lg p-2 bg-red-50/40"><Highlighted text={shown} /></div>}
          {hasStudentId(entry.draft) && (
            <div className="mt-2"><Notice tone="error">초안에 학생 ID(S01 같은 가명)가 들어 있어요. 화면에는 이름으로 보여요. 생기부 문장에는 이름을 쓰지 않으니 지워 주세요.</Notice></div>
          )}
          <div className="flex items-center justify-between mt-2">
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" aria-label="검토 완료" checked={!!entry.reviewed}
                onChange={(e) => update((s) => patchDraft(s, pid, keyName, { reviewed: e.target.checked }))} />
              검토 완료
            </label>
            <div className="flex items-center gap-2">
              {note && <span className="text-xs text-slate-500">{note}</span>}
              <Button onClick={copy} disabled={!entry.reviewed} title={entry.reviewed ? "" : "검토 완료를 눌러야 복사할 수 있어요"}>복사</Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400">아직 초안이 없어요.</p>
      )}

      <GenerateBox {...{ state, st, section, opts, keyName, update, auto, entry }} />

      {entry && (
        <div className="text-xs space-y-3">
          {entry.warnings?.length > 0 && (
            <div>
              <div className="font-semibold text-amber-700 mb-1">확인할 점</div>
              <ul className="list-disc pl-4 space-y-0.5 text-amber-900">{entry.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}
          {entry.missing?.length > 0 && (
            <div>
              <div className="font-semibold text-slate-700 mb-1">보충하면 좋을 관찰</div>
              <ul className="list-disc pl-4 space-y-0.5">{entry.missing.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}
          {entry.evidence?.length > 0 && (
            <div>
              <div className="font-semibold text-slate-700 mb-1">문장별 근거</div>
              <ul className="space-y-1.5">
                {entry.evidence.map((e, i) => (
                  <li key={i} className="border-l-2 border-indigo-300 pl-2">
                    <div>{toRealNames(e.sentence, state.students)}</div>
                    <div className="text-slate-500">← {toRealNames(e.source, state.students)}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
