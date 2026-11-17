import { useRef, useState } from "react";
import { useApp } from "../state.jsx";
import { buildRequest, draftKeyOf } from "../lib/materials.js";
import { buildCopyPrompt, parseDraftResponse, emptyResult, runBatch } from "../lib/provider.js";
import { saveDraft } from "../lib/drafts.js";
import { useSectionPicker } from "../components/SectionPicker.jsx";
import { Card, Button, Notice, EmptyHint, inputCls } from "../components/ui.jsx";

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function confirmGuide(state) {
  return state.settings.guideText.trim() || window.confirm("설정에 기재요령 발췌가 없어요. 그래도 진행할까요?");
}

export default function Generate() {
  const { state, update, goTo } = useApp();
  const { section, opts, ready, picker } = useSectionPicker(state);
  const key = draftKeyOf(section, opts);
  const hasKey = !!state.settings.geminiKey;
  const [forceCopy, setForceCopy] = useState(false);
  const mode = hasKey && !forceCopy ? "auto" : "copy";
  const [skipExisting, setSkipExisting] = useState(true);

  // 최신 상태를 반 전체 생성 중에도 바로 읽기 위해 ref에 둔다
  const stateRef = useRef(state);
  stateRef.current = state;

  const store = (pid, result) => {
    stateRef.current = saveDraft(stateRef.current, pid, key, result);
    update((s) => saveDraft(s, pid, key, result));
  };

  if (state.students.length === 0) {
    return <EmptyHint action={<Button onClick={() => goTo("학생")}>학생 넣으러 가기</Button>}>먼저 학생을 넣어 주세요.</EmptyHint>;
  }

  const hasDraft = (pid) => !!state.drafts[pid]?.[key]?.draft;
  const targets = state.students.filter((s) => !skipExisting || !hasDraft(s.pseudoId)).map((s) => s.pseudoId);

  return (
    <>
      {picker}
      {!ready ? (
        <EmptyHint action={<Button onClick={() => goTo("설정")}>설정으로 가기</Button>}>설정에서 평가계획을 먼저 넣어 주세요.</EmptyHint>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 mb-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
              이미 초안 있는 학생 건너뛰기
            </label>
            {hasKey && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={forceCopy} onChange={(e) => setForceCopy(e.target.checked)} />
                복사·붙여넣기로 하기
              </label>
            )}
          </div>
          {mode === "auto" ? (
            <AutoMode {...{ state, stateRef, section, opts, keyName: key, targets, store, skipExisting }} />
          ) : (
            <CopyMode {...{ state, section, opts, keyName: key, store, skipExisting, hasKey, goTo }} />
          )}
          <StudentStatus state={state} keyName={key} />
        </>
      )}
    </>
  );
}

function AutoMode({ state, stateRef, section, opts, keyName, targets, store, skipExisting }) {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [doneCount, setDoneCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [remaining, setRemaining] = useState(null);
  const [scrubbed, setScrubbed] = useState(0);
  const ctrl = useRef(null);

  const start = async (pids) => {
    if (pids.length === 0) return;
    if (!confirmGuide(state)) return;
    const reviewed = pids.filter((p) => state.drafts[p]?.[keyName]?.reviewed).length;
    if (!skipExisting && reviewed && !window.confirm(`검토 완료한 초안 ${reviewed}개도 새로 써요. 계속할까요?`)) return;
    ctrl.current = new AbortController();
    setRunning(true);
    setRemaining(null);
    setTotal(pids.length);
    setDoneCount(0);
    setScrubbed(0);
    const out = await runBatch({
      getState: () => stateRef.current,
      pseudoIds: pids,
      section,
      opts,
      signal: ctrl.current.signal,
      onStatus: setStatus,
      onResult: (pid, result) => {
        store(pid, result);
        setDoneCount((n) => n + 1);
        if (result.scrubbed) setScrubbed((n) => n + result.scrubbed);
      },
    });
    setRunning(false);
    if (out.pausedAt) {
      setRemaining(pids.slice(pids.indexOf(out.pausedAt)));
    } else {
      setStatus(`다 썼어요. 결과 검토에서 확인해 주세요.`);
    }
  };

  return (
    <Card title="무료 AI로 바로 쓰기" desc="학생 한 명씩 차례로 써요. 무료 한도에 걸리면 기다렸다가 알아서 이어 가요.">
      <div className="flex flex-wrap items-center gap-2">
        {!running && !remaining && (
          <Button onClick={() => start(targets)} disabled={targets.length === 0}>반 전체 생성</Button>
        )}
        {running && <Button variant="ghost" onClick={() => ctrl.current?.abort()}>멈춤</Button>}
        {!running && remaining && (
          <>
            <Button onClick={() => start(remaining)}>이어서 하기</Button>
            <Button variant="ghost" onClick={() => { setRemaining(null); setStatus(""); }}>처음으로</Button>
          </>
        )}
        <span className="text-sm text-stone-500">대상 {targets.length}명</span>
      </div>
      {total > 0 && (
        <div className="mt-3">
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-600 transition-all" style={{ width: `${(doneCount / total) * 100}%` }} />
          </div>
          <p className="text-sm mt-1">{doneCount} / {total} 완료</p>
        </div>
      )}
      {status && <p className="text-sm text-stone-600 mt-1">{status}</p>}
      {scrubbed > 0 && <div className="mt-2"><Notice tone="warn">실명 {scrubbed}곳을 가명으로 바꿔 보냈어요.</Notice></div>}
    </Card>
  );
}

function CopyMode({ state, section, opts, keyName, store, skipExisting, hasKey, goTo }) {
  const students = state.students;
  const firstPid = (students.find((s) => !skipExisting || !state.drafts[s.pseudoId]?.[keyName]?.draft) || students[0]).pseudoId;
  const [pidSel, setPid] = useState(null);
  const pid = students.some((s) => s.pseudoId === pidSel) ? pidSel : firstPid;
  const st = students.find((s) => s.pseudoId === pid);
  const [answer, setAnswer] = useState("");
  const [msg, setMsg] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const req = buildRequest(state, pid, section, opts);
  const prompt = buildCopyPrompt(req);

  const goNext = (afterState) => {
    const idx = students.findIndex((s) => s.pseudoId === pid);
    const next = students.slice(idx + 1).find((s) => !skipExisting || !afterState.drafts[s.pseudoId]?.[keyName]?.draft);
    if (next) setPid(next.pseudoId);
    else setMsg({ tone: "info", text: "마지막 학생까지 했어요. 결과 검토에서 확인해 주세요." });
    setAnswer("");
    setShowPrompt(false);
  };

  const commit = (result) => {
    if (state.drafts[pid]?.[keyName]?.reviewed && !window.confirm("검토 완료한 초안을 새 답으로 바꿀까요?")) return;
    store(pid, result);
    const after = { ...state, drafts: { ...state.drafts, [pid]: { ...(state.drafts[pid] || {}), [keyName]: { draft: result.draft } } } };
    setMsg(null);
    goNext(after);
  };

  const copy = async () => {
    if (!confirmGuide(state)) return;
    const ok = await copyText(prompt);
    setMsg(ok ? { tone: "info", text: "복사했어요. AI 채팅 새 창에 붙여넣으세요." } : { tone: "warn", text: "자동 복사가 안 돼요. 아래 프롬프트를 직접 선택해 복사해 주세요." });
    if (!ok) setShowPrompt(true);
  };

  const save = () => {
    const result = parseDraftResponse(answer, pid, section);
    if (result.idMismatch && !window.confirm(`다른 학생(${result.student_id})의 답 같아요. 그래도 ${st.number}번에 저장할까요?`)) return;
    commit(result);
  };

  return (
    <Card title="복사·붙여넣기로 쓰기"
      desc="프롬프트를 복사해 Claude·ChatGPT·Gemini 채팅 새 창에 붙여넣고, 받은 답을 아래에 붙여넣으세요. 학생마다 새 채팅을 여는 게 좋아요.">
      {!hasKey && (
        <p className="text-xs text-stone-500 mb-3">
          설정에 무료 API 키를 넣으면 버튼 하나로 반 전체를 자동으로 쓸 수 있어요.{" "}
          <button type="button" className="underline" onClick={() => goTo("설정")}>설정으로</button>
        </p>
      )}
      <div className="flex items-center gap-2 mb-3">
        <label className="text-sm text-stone-600" htmlFor="copy-student">학생</label>
        <select id="copy-student" className="border border-stone-300 rounded-lg px-2 py-1 text-sm" value={pid} onChange={(e) => { setPid(e.target.value); setAnswer(""); setMsg(null); }}>
          {students.map((s) => (
            <option key={s.pseudoId} value={s.pseudoId}>{s.number}번 {s.name}{state.drafts[s.pseudoId]?.[keyName]?.draft ? " ✓" : ""}</option>
          ))}
        </select>
      </div>
      <h3 className="font-semibold mb-2">{st.number}번 {st.name}</h3>

      {req.empty ? (
        <div className="space-y-2">
          <Notice tone="warn">이 학생은 이 항목에 고른 칩·등급·메모가 없어요. 입력 화면에서 먼저 골라 주세요.</Notice>
          <Button variant="ghost" onClick={() => commit({ ...emptyResult(pid, section), idMismatch: false })}>보충 필요로 저장하고 넘어가기</Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={copy}>프롬프트 복사</Button>
            <button type="button" className="text-xs underline text-stone-500" onClick={() => setShowPrompt((v) => !v)}>
              {showPrompt ? "프롬프트 접기" : "프롬프트 보기"}
            </button>
            <span className="text-xs text-stone-500">새 채팅에 붙여넣으세요</span>
          </div>
          {req.scrubbed > 0 && <div className="mt-2"><Notice tone="warn">실명 {req.scrubbed}곳을 가명으로 바꿔 복사해요.</Notice></div>}
          {showPrompt && <textarea readOnly className={`${inputCls} h-40 mt-2 font-mono text-xs`} value={prompt} aria-label="프롬프트" />}
          <textarea aria-label="답 붙여넣기" className={`${inputCls} h-32 mt-3`} placeholder="AI가 준 답(JSON)을 그대로 붙여넣으세요"
            value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <div className="flex justify-end mt-2">
            <Button onClick={save} disabled={!answer.trim()}>답 저장</Button>
          </div>
        </>
      )}
      {msg && <div className="mt-2"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
    </Card>
  );
}

function StudentStatus({ state, keyName }) {
  const done = state.students.filter((s) => state.drafts[s.pseudoId]?.[keyName]?.draft).length;
  const reviewed = state.students.filter((s) => state.drafts[s.pseudoId]?.[keyName]?.reviewed).length;
  return (
    <p className="text-sm text-stone-500">
      이 항목 초안 {done} / {state.students.length}명 · 검토 완료 {reviewed}명
    </p>
  );
}
