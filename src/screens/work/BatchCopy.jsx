import { useState } from "react";
import { buildRequest } from "../../lib/materials.js";
import { buildBatchCopyPrompt, parseBatchResponse } from "../../lib/provider.js";
import { saveDraft } from "../../lib/drafts.js";
import { Button, Notice, inputCls } from "../../components/ui.jsx";
import { copyText, confirmGuide } from "./DraftPane.jsx";

const SIZES = [["5", "5명"], ["10", "10명"], ["15", "15명"], ["all", "전체"]];

// 키 없이 여러 학생을 프롬프트 하나로 복사하고, AI가 준 JSON 배열을 학생별로 나눠 저장한다.
export default function BatchCopy({ state, update, section, opts, keyName, inputPids, skipExisting }) {
  const [size, setSize] = useState("10");
  const [offset, setOffset] = useState(0);
  const [answer, setAnswer] = useState("");
  const [msg, setMsg] = useState(null);
  const [prompt, setPrompt] = useState("");

  const hasDraft = (pid) => !!state.drafts[pid]?.[keyName]?.draft;
  const targets = inputPids.filter((pid) => !skipExisting || !hasDraft(pid));
  const n = size === "all" ? targets.length : Number(size);
  // 건너뛰기를 켜면 저장된 학생이 빠지므로 늘 앞에서부터, 끄면 묶음 위치를 기억한다
  const start = skipExisting || offset >= targets.length ? 0 : offset;
  const chunk = targets.slice(start, start + n);
  const nameOf = (pid) => {
    const s = state.students.find((x) => x.pseudoId === pid);
    return s ? `${s.number}번 ${s.name}` : pid;
  };

  const copy = async () => {
    if (!confirmGuide(state)) return;
    const reviewed = chunk.filter((p) => state.drafts[p]?.[keyName]?.reviewed).length;
    if (reviewed && !window.confirm(`검토 완료한 초안 ${reviewed}개도 새로 쓰게 돼요. 계속할까요?`)) return;
    const reqs = chunk.map((pid) => buildRequest(state, pid, section, opts));
    const text = buildBatchCopyPrompt(reqs);
    const scrubbed = reqs.some((r) => r.scrubbed > 0);
    const ok = await copyText(text);
    setPrompt(ok ? "" : text);
    setMsg({
      tone: ok ? "info" : "warn",
      text: (ok ? `${chunk.length}명 프롬프트를 복사했어요. AI 채팅 새 창에 붙여넣고, 받은 답 전체를 아래에 붙여넣으세요.` : "자동 복사가 안 돼요. 아래 프롬프트를 직접 선택해 복사해 주세요.")
        + (scrubbed ? " (메모 속 실명은 가명으로 바꿨어요.)" : ""),
    });
  };

  const save = () => {
    const out = parseBatchResponse(answer, inputPids, section);
    if (!out.ok) {
      setMsg({ tone: "error", text: "답에서 JSON 배열을 찾지 못했어요. AI 답 전체를 그대로 붙여넣었는지 확인해 주세요." });
      return;
    }
    const pids = Object.keys(out.results);
    if (pids.length === 0) {
      setMsg({ tone: "error", text: "이 항목 학생의 답을 찾지 못했어요. 다른 항목이나 다른 반의 답인지 확인해 주세요." });
      return;
    }
    const reviewed = pids.filter((p) => state.drafts[p]?.[keyName]?.reviewed).length;
    if (reviewed && !window.confirm(`검토 완료한 초안 ${reviewed}개를 새 답으로 바꿀까요?`)) return;
    update((s) => pids.reduce((acc, pid) => saveDraft(acc, pid, keyName, out.results[pid]), s));
    const notInAnswer = chunk.filter((p) => !out.results[p]);
    const parts = [`${pids.length}명 저장했어요. 학생을 넘기며 검토해 주세요.`];
    if (notInAnswer.length) parts.push(`답이 없는 학생: ${notInAnswer.map(nameOf).join(", ")}`);
    if (out.unknown.length) parts.push(`목록에 없는 ID라 버린 답: ${out.unknown.join(", ")}`);
    setMsg({ tone: notInAnswer.length || out.unknown.length ? "warn" : "info", text: parts.join(" · ") });
    setAnswer("");
    setPrompt("");
    if (!skipExisting) setOffset(start + n >= targets.length ? 0 : start + n);
  };

  return (
    <div className="border-t border-slate-100 pt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-slate-700">여러 명 한 번에</span>
        <label className="text-slate-600 flex items-center gap-1">
          <span className="sr-only">한 번에 몇 명</span>
          <select aria-label="한 번에 몇 명" className="border border-slate-300 rounded-lg px-2 py-1 text-sm" value={size}
            onChange={(e) => { setSize(e.target.value); setOffset(0); }}>
            {SIZES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <Button onClick={copy} disabled={chunk.length === 0}>{chunk.length}명 프롬프트 복사</Button>
        <span className="text-xs text-slate-500">
          {targets.length === 0 ? "쓸 학생이 없어요 (입력이 없거나 모두 초안이 있어요)" : `${start + 1}~${start + chunk.length}번째 · 대상 ${targets.length}명`}
        </span>
      </div>
      {prompt && <textarea readOnly aria-label="여러 명 프롬프트" className={`${inputCls} h-28 font-mono text-xs`} value={prompt} />}
      <div className="flex gap-2 items-start">
        <textarea aria-label="여러 명 답 붙여넣기" className={`${inputCls} h-16 flex-1`} placeholder="AI가 준 답 전체(JSON 배열)를 붙여넣으세요"
          value={answer} onChange={(e) => setAnswer(e.target.value)} />
        <Button onClick={save} disabled={!answer.trim()}>여러 명 답 저장</Button>
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </div>
  );
}
