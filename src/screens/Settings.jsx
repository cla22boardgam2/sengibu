import { useEffect, useRef, useState } from "react";
import { useAppState } from "../state.jsx";
import { parseEvalPlanTSV, parseEvalPlanXlsx, subjectsOf } from "../lib/evalPlan.js";
import { AREAS, CHIP_GROUPS } from "../lib/defaults.js";
import { DEFAULT_GEMINI_MODEL, MODEL_SUGGESTIONS } from "../lib/provider.js";
import { Button, inputCls, Notice } from "../components/ui.jsx";
import { setupSteps } from "../lib/progress.js";

const uid = () => Math.random().toString(36).slice(2, 9);

function summarize(rows, skipped) {
  const counts = subjectsOf(rows).map((s) => `${s} ${rows.filter((r) => r.subject === s).length}개`);
  return `읽었어요: ${counts.join(", ") || "없음"}${skipped ? ` · ${skipped}줄 건너뜀(평가요소나 기준이 빈 줄)` : ""}`;
}

function EvalPlanCard() {
  const [state, update] = useAppState();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState(null);

  const apply = ({ rows, skipped }) => {
    if (rows.length === 0) {
      setMsg({ tone: "error", text: "읽은 줄이 없어요. 양식의 칸 순서를 확인해 주세요." });
      return;
    }
    update((s) => ({ ...s, evalPlan: rows }));
    setMsg({ tone: skipped ? "warn" : "info", text: summarize(rows, skipped) });
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      apply(parseEvalPlanXlsx(await f.arrayBuffer()));
    } catch {
      setMsg({ tone: "error", text: "엑셀 파일을 읽지 못했어요. 앱에서 내려받은 양식(.xlsx)인지 확인해 주세요." });
    }
  };

  const subjects = subjectsOf(state.evalPlan);
  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-2"><p className="text-sm text-stone-500">학교 평가계획서의 표를 양식 칸 순서에 맞춰 옮겨 주세요. 3단계 평가면 '매우잘함' 칸을 비워 두세요.</p><a className="text-sm text-emerald-700 underline whitespace-nowrap" href="./평가계획_양식.xlsx" download>양식 내려받기</a></div>
      <p className="text-xs text-stone-500 mb-2">칸 순서: 교과 · 영역(단원) · 성취기준 코드 · 평가요소 · 매우잘함 · 잘함 · 보통 · 노력요함</p>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="text-sm">엑셀 올리기 <input type="file" accept=".xlsx,.xls" onChange={onFile} className="text-sm" aria-label="평가계획 파일 올리기" /></label>
      </div>
      <textarea
        aria-label="평가계획 붙여넣기"
        className={`${inputCls} h-28 font-mono text-xs`}
        placeholder="또는 엑셀·한글 표를 복사해 여기에 붙여넣으세요"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex justify-end mt-2">
        <Button onClick={() => apply(parseEvalPlanTSV(text))} disabled={!text.trim()}>평가계획 읽기</Button>
      </div>
      {msg && <div className="mt-2"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      {subjects.length > 0 && (
        <p className="text-sm text-stone-600 mt-3">
          지금 들어 있는 평가계획: {subjects.map((s) => `${s}(${state.evalPlan.filter((r) => r.subject === s).length})`).join(" · ")}
        </p>
      )}
    </>
  );
}

function ActivitiesCard() {
  const [state, update] = useAppState();
  const set = (id, patch) =>
    update((s) => ({ ...s, activities: s.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  return (
    <>
      <p className="text-sm text-stone-500 mb-2">학교 교육활동 이름과 짧은 설명이에요. AI는 이 목록에 있는 활동명만 써요.</p>
      <div className="space-y-2">
        {state.activities.map((a) => (
          <div key={a.id} className="grid grid-cols-1 sm:grid-cols-[9rem_10rem_1fr_auto] gap-2">
            <select className={inputCls} value={a.area} onChange={(e) => set(a.id, { area: e.target.value })} aria-label="영역">
              {AREAS.map((x) => <option key={x}>{x}</option>)}
            </select>
            <input className={inputCls} value={a.name} placeholder="행사 이름" onChange={(e) => set(a.id, { name: e.target.value })} aria-label="행사 이름" />
            <input className={inputCls} value={a.desc} placeholder="짧은 설명 (무엇을 했는지)" onChange={(e) => set(a.id, { desc: e.target.value })} aria-label="행사 설명" />
            <Button variant="danger" onClick={() => update((s) => ({ ...s, activities: s.activities.filter((x) => x.id !== a.id) }))}>삭제</Button>
          </div>
        ))}
      </div>
      <Button variant="ghost" className="mt-3"
        onClick={() => update((s) => ({ ...s, activities: [...s.activities, { id: uid(), area: AREAS[1], name: "", desc: "" }] }))}>
        + 행사 추가
      </Button>
    </>
  );
}

function ChipEditor({ chips, onRemove, onAdd, label, negative }) {
  const [text, setText] = useState("");
  const add = () => { if (text.trim()) { onAdd(text.trim()); setText(""); } };
  return (
    <div className="mb-3">
      <div className="text-sm font-medium text-stone-700 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {chips.map((c) => (
          <span key={c.id} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${negative ? "border-amber-300 bg-amber-50" : "border-stone-300 bg-stone-50"}`}>
            {c.text}
            <button type="button" aria-label={`${c.text} 칩 빼기`} className="text-stone-400 hover:text-red-600" onClick={() => onRemove(c.id)}>×</button>
          </span>
        ))}
        <input
          className="border border-dashed border-stone-300 rounded-full px-2.5 py-1 text-xs w-28"
          placeholder="+ 칩 추가" value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          onBlur={add}
          aria-label={`${label} 칩 추가`}
        />
      </div>
    </div>
  );
}

function ChipsCard() {
  const [state, update] = useAppState();
  const removeC = (id) => update((s) => ({ ...s, chips: { ...s.chips, C: s.chips.C.filter((c) => c.id !== id) } }));
  const addC = (group) => (text) =>
    update((s) => s.chips.C.some((c) => c.text === text) ? s
      : ({ ...s, chips: { ...s.chips, C: [...s.chips.C, { id: `c-${uid()}`, group, text, negative: group === "노력할 점" }] } }));
  const removeB = (id) => update((s) => ({ ...s, chips: { ...s.chips, B: s.chips.B.filter((c) => c.id !== id) } }));
  const addB = (text) =>
    update((s) => s.chips.B.some((c) => c.text === text) ? s
      : ({ ...s, chips: { ...s.chips, B: [...s.chips.B, { id: `b-${uid()}`, text }] } }));
  return (
    <>
      <p className="text-sm text-stone-500 mb-2">선생님 말투에 맞게 더하거나 빼세요. 칩을 빼면 그 칩을 고른 학생의 문장 재료에서도 빠져요.</p>
      {CHIP_GROUPS.map((g) => (
        <ChipEditor key={g} label={`행발 · ${g}`} negative={g === "노력할 점"}
          chips={state.chips.C.filter((c) => c.group === g)} onRemove={removeC} onAdd={addC(g)} />
      ))}
      <ChipEditor label="창체 · 역할" chips={state.chips.B} onRemove={removeB} onAdd={addB} />
    </>
  );
}

const BADGE = {
  필수: "bg-red-50 text-red-700 border-red-200",
  교과: "bg-sky-50 text-sky-700 border-sky-200",
  창체: "bg-violet-50 text-violet-700 border-violet-200",
  선택: "bg-stone-50 text-stone-500 border-stone-200",
  고급: "bg-stone-50 text-stone-500 border-stone-200",
};

// 접었다 펴는 설정 묶음. 접혀 있어도 내용은 남겨 둔다(입력 중인 글이 사라지지 않게).
function Fold({ id, title, need, done, open, onToggle, children }) {
  return (
    <section id={`settings-${id}`} className="bg-white border border-stone-200 rounded-xl mb-3 scroll-mt-20">
      <button type="button" aria-expanded={open} aria-controls={`settings-body-${id}`} onClick={onToggle}
        className="w-full flex items-center gap-2 px-5 py-3 text-left">
        <span className="font-semibold text-stone-800">{title}</span>
        {need && <span className={`text-[11px] border rounded-full px-2 py-0.5 ${BADGE[need]}`}>{need === "교과" ? "교과 평어에 필요" : need === "창체" ? "창체에 필요" : need}</span>}
        {done != null && <span className={`text-xs ${done ? "text-emerald-700" : "text-amber-700"}`}>{done ? "✓ 완료" : "아직"}</span>}
        <span className="ml-auto text-xs text-stone-400">{open ? "접기 ▲" : "펼치기 ▼"}</span>
      </button>
      <div id={`settings-body-${id}`} hidden={!open} className="px-5 pb-5">{children}</div>
    </section>
  );
}

export default function Settings({ focus }) {
  const [state, update] = useAppState();
  const st = state.settings;
  const set = (patch) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  const setLimit = (k, v) => set({ byteLimits: { ...st.byteLimits, [k]: v === "" ? null : Math.max(0, Number(v)) } });
  const done = Object.fromEntries(setupSteps(state).map((s) => [s.id, s.done]));

  // 처음엔 아직 안 한 필수 묶음을 펼쳐 둔다
  const [open, setOpen] = useState(() => {
    const first = ["guide", "limits"].filter((id) => !done[id]);
    return Object.fromEntries((first.length ? first : ["guide"]).map((id) => [id, true]));
  });
  const flip = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const root = useRef(null);

  // 홈이나 작업 화면에서 "○○ 넣기"로 오면 그 묶음을 펼치고 보여 준다
  useEffect(() => {
    const id = focus?.value;
    if (!id) return;
    setOpen((o) => ({ ...o, [id]: true }));
    setTimeout(() => root.current?.querySelector(`#settings-${id}`)?.scrollIntoView?.({ block: "start", behavior: "smooth" }), 0);
  }, [focus]);

  const fold = (id, title, need, isDone, body) => (
    <Fold id={id} title={title} need={need} done={isDone} open={!!open[id]} onToggle={() => flip(id)}>{body}</Fold>
  );

  return (
    <div ref={root}>
      {fold("guide", "기재요령 발췌", "필수", done.guide, (
        <>
          <p className="text-sm text-stone-500 mb-2">기재 길라잡이에서 평어·창체·행발 기재 방법과 유의사항 부분을 복사해 붙여넣으세요. AI가 가장 먼저 따르는 기준이에요.</p>
          <textarea className={`${inputCls} h-40`} value={st.guideText} onChange={(e) => set({ guideText: e.target.value })} aria-label="기재요령 발췌" />
        </>
      ))}

      {fold("limits", "글자 수 상한 (바이트)", "필수", done.limits, (
        <>
          <p className="text-sm text-stone-500 mb-2">나이스 기준 바이트 상한이에요. 기재 길라잡이에서 확인해 넣어 주세요. 한글 1자는 3바이트예요.</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {[["A", "교과 평어"], ["B", "창체 (영역별)"], ["C", "행발"]].map(([k, l]) => (
              <label key={k} className="text-sm">{l}
                <input type="number" min="0" className={inputCls} value={st.byteLimits[k] ?? ""} onChange={(e) => setLimit(k, e.target.value)} />
                {st.byteLimits[k] == null && <span className="text-xs text-amber-700">미확인 — 기재요령에서 확인 후 입력</span>}
              </label>
            ))}
          </div>
        </>
      ))}

      {fold("plan", "평가계획", "교과", done.plan, <EvalPlanCard />)}
      {fold("activities", "행사 목록", "창체", done.activities, <ActivitiesCard />)}

      {fold("ai", "AI 연결 (무료)", "선택", done.ai, (
        <>
          <p className="text-sm text-stone-500 mb-2">Google AI Studio에서 무료 API 키를 만들어 붙여넣으세요. 카드 등록은 필요 없어요. 키가 없으면 복사·붙여넣기 방식으로 쓸 수 있어요.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm">API 키
              <input type="password" autoComplete="off" className={inputCls} value={st.geminiKey}
                onChange={(e) => set({ geminiKey: e.target.value.trim() })} placeholder="AIza..." aria-label="Gemini API 키" />
            </label>
            <label className="text-sm">모델 이름
              <input list="gemini-models" className={inputCls} value={st.geminiModel}
                onChange={(e) => set({ geminiModel: e.target.value })} placeholder={DEFAULT_GEMINI_MODEL} aria-label="모델 이름" />
              <datalist id="gemini-models">{MODEL_SUGGESTIONS.map((m) => <option key={m} value={m} />)}</datalist>
            </label>
          </div>
          <p className="text-sm mt-2">
            <a className="text-emerald-700 underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">무료 API 키 만들기 (Google AI Studio)</a>
            <span className="text-stone-500"> · 키는 이 브라우저에만 저장되고 백업 파일에도 들어가지 않아요.</span>
          </p>
        </>
      ))}
      {/* 무료 등급 안내는 접어도 늘 보이게 둔다 */}
      <div className="mb-3 -mt-1">
        <Notice tone="warn">무료 등급은 보낸 내용이 서비스 개선에 쓰일 수 있어요. 앱은 가명만 보내지만 메모에 민감한 내용은 쓰지 마세요.</Notice>
      </div>

      {fold("basic", "기본 설정 (학년·분량)", null, null, (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="text-sm">학년
              <select className={inputCls} value={st.grade} onChange={(e) => set({ grade: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5, 6].map((g) => <option key={g} value={g}>{g}학년</option>)}
              </select>
            </label>
            <div className="text-sm sm:col-span-2">분량
              <div className="flex gap-1 mt-1">
                {[["short", "짧게"], ["normal", "보통"], ["long", "길게"]].map(([k, l]) => (
                  <button key={k} type="button" onClick={() => set({ length: k })}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${st.length === k ? "bg-emerald-700 text-white border-emerald-700" : "border-stone-300"}`}>{l}</button>
                ))}
              </div>
            </div>
          </div>
          <label className="text-sm block mt-3">반 전체 추가 지시 (선택)
            <textarea className={`${inputCls} h-16`} value={st.classNote} onChange={(e) => set({ classNote: e.target.value })}
              placeholder="예: 문장 끝을 '~함'보다 '~임', '~보임'으로 다양하게" />
          </label>
        </>
      ))}

      {fold("report", "통지표 종합의견", null, null, (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm">글자 수 (공백 포함)
              <input type="number" min="50" className={inputCls} value={st.reportMaxChars} onChange={(e) => set({ reportMaxChars: Number(e.target.value) || 300 })} />
            </label>
            <label className="text-sm flex items-center gap-2 mt-5">
              <input type="checkbox" checked={st.hasSchoolGuide} onChange={(e) => set({ hasSchoolGuide: e.target.checked })} />
              학교 통지표 지침이 있어요
            </label>
          </div>
          {st.hasSchoolGuide && (
            <textarea className={`${inputCls} h-24 mt-3`} value={st.reportGuideText} onChange={(e) => set({ reportGuideText: e.target.value })}
              placeholder="학교 통지표 작성 지침을 붙여넣으세요" aria-label="통지표 지침" />
          )}
        </>
      ))}

      {fold("chips", "고급 · 칩 목록 고치기", "고급", null, <ChipsCard />)}
    </div>
  );
}
