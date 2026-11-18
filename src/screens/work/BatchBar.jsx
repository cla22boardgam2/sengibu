import { useRef, useState } from "react";
import { runBatch } from "../../lib/provider.js";
import { saveDraft } from "../../lib/drafts.js";
import { toRealNames } from "../../lib/students.js";
import { Button, Notice } from "../../components/ui.jsx";
import { copyText, confirmGuide } from "./DraftPane.jsx";
import BatchCopy from "./BatchCopy.jsx";

// "입력된 학생 전체 생성". 시작할 때의 항목(key)을 붙잡아 두므로, 도중에 다른 항목을 봐도 원래 항목에 저장된다.
export default function BatchBar({ state, stateRef, update, section, opts, keyName, label, inputPids, auto, hasKey, forceCopy, setForceCopy, goTo }) {
  const [skipExisting, setSkipExisting] = useState(true);
  const [run, setRun] = useState(null); // { label, total, done, status, scrubbed, running, remaining, section, opts, key }
  const [note, setNote] = useState("");
  const [groupSize, setGroupSize] = useState(5); // 한 요청에 몇 명 (무료 한도의 요청 횟수를 아낀다)
  const ctrl = useRef(null);

  const hasDraft = (pid) => !!state.drafts[pid]?.[keyName]?.draft;
  const targets = inputPids.filter((pid) => !skipExisting || !hasDraft(pid));
  const reviewedSt = state.students.filter((s) => state.drafts[s.pseudoId]?.[keyName]?.reviewed && state.drafts[s.pseudoId][keyName].draft);

  const start = async (pids, job) => {
    if (pids.length === 0) return;
    if (!confirmGuide(state)) return;
    const reviewed = pids.filter((p) => state.drafts[p]?.[job.key]?.reviewed).length;
    if (reviewed && !window.confirm(`검토 완료한 초안 ${reviewed}개도 새로 써요. 계속할까요?`)) return;
    ctrl.current = new AbortController();
    let doneN = 0;
    let scrubbed = 0;
    const set = (patch) => setRun((r) => ({ ...r, ...patch }));
    setRun({ ...job, total: pids.length, done: 0, status: "", scrubbed: 0, running: true, remaining: null });
    const out = await runBatch({
      getState: () => stateRef.current,
      pseudoIds: pids,
      section: job.section,
      opts: job.opts,
      signal: ctrl.current.signal,
      groupSize,
      onStatus: (status) => set({ status }),
      onResult: (pid, result) => {
        stateRef.current = saveDraft(stateRef.current, pid, job.key, result);
        update((s) => saveDraft(s, pid, job.key, result));
        doneN += 1;
        scrubbed += result.scrubbed || 0;
        set({ done: doneN, scrubbed });
      },
    });
    set(out.pausedAt
      ? { running: false, remaining: out.remaining?.length ? out.remaining : pids.slice(pids.indexOf(out.pausedAt)) }
      : { running: false, remaining: null, status: "다 썼어요. 학생을 넘기며 검토해 주세요." });
  };

  const copyAll = async () => {
    const text = reviewedSt.map((s) => `${s.number}\t${toRealNames(state.drafts[s.pseudoId][keyName].draft, state.students)}`).join("\n");
    setNote((await copyText(text)) ? `${reviewedSt.length}명 복사했어요 (번호, 탭, 초안 순).` : "복사가 안 돼요.");
  };

  const running = run?.running;
  return (
    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 px-3 py-2 space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {auto ? (
          <>
            {!running && !run?.remaining && (
              <Button onClick={() => start(targets, { section, opts, key: keyName, label })} disabled={targets.length === 0}>
                입력된 학생 전체 생성 ({targets.length}명)
              </Button>
            )}
            {running && <Button variant="ghost" onClick={() => ctrl.current?.abort()}>멈춤</Button>}
            <label className="flex items-center gap-1.5 text-slate-600">
              한 요청에
              <select aria-label="API 한 번에 몇 명" className="border border-slate-300 rounded-lg px-2 py-1 text-sm"
                value={groupSize} disabled={running} onChange={(e) => setGroupSize(Number(e.target.value))}>
                {[1, 5, 10].map((n) => <option key={n} value={n}>{n}명</option>)}
              </select>
            </label>
            {!running && run?.remaining && (
              <>
                <Button onClick={() => start(run.remaining, run)}>이어서 하기</Button>
                <Button variant="ghost" onClick={() => setRun(null)}>처음으로</Button>
              </>
            )}
          </>
        ) : (
          <span className="text-slate-600">
            {hasKey ? "복사·붙여넣기 방식이에요." : "API 키 없이 복사·붙여넣기로 써요. 아래에서 여러 명을 한 번에, 오른쪽에서 한 명씩."}
            {!hasKey && <button type="button" className="underline text-indigo-700 ml-1" onClick={() => goTo("설정", "ai")}>AI 연결하기</button>}
          </span>
        )}
        <label className="flex items-center gap-1.5 text-slate-600">
          <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
          초안 있는 학생 건너뛰기
        </label>
        {hasKey && (
          <label className="flex items-center gap-1.5 text-slate-600">
            <input type="checkbox" checked={forceCopy} onChange={(e) => setForceCopy(e.target.checked)} />
            복사·붙여넣기로 하기
          </label>
        )}
        <button type="button" className="text-xs underline text-slate-500" onClick={() => goTo("사용법", "ways")}>어떤 방법이 좋을까요?</button>
        <span className="ml-auto flex items-center gap-2">
          {note && <span className="text-xs text-slate-500">{note}</span>}
          <Button variant="ghost" onClick={copyAll} disabled={reviewedSt.length === 0}>검토 완료 {reviewedSt.length}명 모두 복사</Button>
        </span>
      </div>
      {!auto && <BatchCopy {...{ state, update, section, opts, keyName, inputPids, skipExisting }} />}
      {run && (
        <div>
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 transition-all" style={{ width: `${run.total ? (run.done / run.total) * 100 : 0}%` }} />
            </div>
            <span className="text-sm tabular-nums">{run.done} / {run.total} 완료</span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {run.label !== label && <b>{run.label}: </b>}{run.status}
          </p>
          {run.scrubbed > 0 && <div className="mt-1"><Notice tone="warn">실명 {run.scrubbed}곳을 가명으로 바꿔 보냈어요.</Notice></div>}
        </div>
      )}
    </div>
  );
}
