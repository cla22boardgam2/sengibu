import { useApp } from "../state.jsx";
import { setupSteps, sectionReadiness, sectionProgress } from "../lib/progress.js";
import { Button } from "../components/ui.jsx";

const NEED_STYLE = {
  필수: "bg-rose-50 text-rose-700 border-rose-200",
  교과: "bg-amber-50 text-amber-800 border-amber-200",
  창체: "bg-sky-50 text-sky-700 border-sky-200",
  선택: "bg-slate-50 text-slate-500 border-slate-200",
};
const NEED_TEXT = { 필수: "필수", 교과: "교과 평어에 필요", 창체: "창체에 필요", 선택: "선택" };

// 항목 카드: 아이콘, 색, 할 수 있는 일
const SECTIONS = [
  {
    sec: "C", short: "행발", title: "행동특성 및 종합의견", sub: "학년말 종합의견", icon: "🌱",
    tone: { title: "text-violet-900", pill: "bg-violet-100 text-violet-700 hover:bg-violet-200", bar: "bg-violet-500", ring: "hover:ring-violet-200" },
    points: ["성품·학습·친구·생활 칩으로 고르기", "같은 반 학생과 표현이 겹치지 않게", "나이스 바이트 수 바로 확인"],
  },
  {
    sec: "A", short: "교과 평어", title: "교과 평어", sub: "교과별 세부능력 및 특기사항", icon: "📘",
    tone: { title: "text-amber-900", pill: "bg-amber-100 text-amber-800 hover:bg-amber-200", bar: "bg-amber-500", ring: "hover:ring-amber-200" },
    points: ["학교 평가계획을 엑셀 양식으로 넣기", "성취기준과 등급(매잘·잘함·보통·노력)에 맞춰", "반 전체 같은 등급을 한 번에"],
  },
  {
    sec: "B", short: "창체", title: "창의적 체험활동", sub: "자율·자치 / 동아리 / 진로", icon: "🎯",
    tone: { title: "text-sky-900", pill: "bg-sky-100 text-sky-700 hover:bg-sky-200", bar: "bg-sky-500", ring: "hover:ring-sky-200" },
    points: ["학교 행사 목록으로만 쓰기", "참여한 행사와 맡은 역할 고르기", "영역별 특기사항 작성"],
  },
  {
    sec: "D", short: "통지표", title: "통지표 종합의견", sub: "가정에 보내는 글", icon: "💌",
    tone: { title: "text-emerald-900", pill: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200", bar: "bg-emerald-500", ring: "hover:ring-emerald-200" },
    points: ["교과 등급과 행발 칩을 모아서", "학부모님이 읽기 쉬운 말로", "글자 수(공백 포함) 확인"],
  },
];

function Bar({ value, total, cls }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Checklist({ steps, next, go, goTo }) {
  const doneN = steps.filter((s) => s.done).length;
  return (
    <section className="bg-white rounded-2xl shadow-sm ring-1 ring-indigo-100 p-5 sm:p-6 mb-6">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h2 className="font-bold text-lg text-indigo-950">시작 준비</h2>
          <p className="text-sm text-slate-500 mt-0.5">필수 3가지를 먼저 채우세요. 그다음 쓰려는 항목에 필요한 것만 채우면 돼요.</p>
        </div>
        <Button variant="ghost" onClick={() => goTo("사용법")}>사용법 보기</Button>
      </div>
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1"><Bar value={doneN} total={steps.length} cls="bg-indigo-500" /></div>
        <span className="text-xs text-slate-500 tabular-nums">{doneN} / {steps.length}</span>
      </div>
      <ol className="divide-y divide-slate-100">
        {steps.map((s, i) => (
          <li key={s.id} className={`flex items-center gap-3 py-2.5 ${next?.id === s.id ? "bg-indigo-50/70 -mx-3 px-3 rounded-xl" : ""}`}>
            <span aria-hidden="true"
              className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold ${s.done ? "bg-indigo-600 text-white" : "border-2 border-slate-300 text-slate-500"}`}>
              {s.done ? "✓" : i + 1}
            </span>
            <span className="flex-1 min-w-0">
              <span className="font-medium text-slate-800">{s.label}</span>
              <span className={`ml-2 text-[11px] border rounded-full px-2 py-0.5 align-middle ${NEED_STYLE[s.need]}`}>{NEED_TEXT[s.need]}</span>
            </span>
            <span className={`text-xs ${s.done ? "text-indigo-700" : "text-slate-400"}`}>{s.done ? "완료" : "아직"}</span>
            <Button variant={s.done ? "ghost" : "primary"} onClick={() => go(s.go)} aria-label={`${s.label} ${s.done ? "보기" : "하러 가기"}`}>
              {s.done ? "보기" : "하러 가기"}
            </Button>
          </li>
        ))}
      </ol>
      {next && <p className="text-sm text-indigo-800 mt-2">다음 할 일: <b>{next.label}</b></p>}
    </section>
  );
}

export default function Home() {
  const { state, goTo } = useApp();
  const steps = setupSteps(state);
  const next = steps.find((s) => !s.done && s.need === "필수");
  const go = (target) => goTo(...target);
  const checklist = <Checklist steps={steps} next={next} go={go} goTo={goTo} />;

  return (
    <>
      {next && checklist}

      <div className="text-center my-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">어떤 기록을 쓸까요?</h2>
        <p className="text-slate-500 mt-2">칩과 등급을 고르면 AI가 학생마다 다른 문장으로 초안을 써 드려요</p>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-8">
        {SECTIONS.map(({ sec, short, title, sub, icon, tone, points }) => {
          const { ready, missing } = sectionReadiness(state, sec);
          const p = sectionProgress(state, sec);
          return (
            <section key={sec} aria-label={`${short} 카드`}
              className={`bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 hover:shadow-md ${tone.ring} hover:ring-2 transition p-6 flex flex-col`}>
              <div className="flex items-start gap-4">
                <span aria-hidden="true" className="text-4xl leading-none mt-1">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`text-xl font-bold ${tone.title}`}>{title}</h3>
                    <span className={`shrink-0 text-xs rounded-full px-2 py-0.5 ${ready ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-800"}`}>
                      {ready ? "준비 완료" : "준비 필요"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">{sub}</p>
                  <ul className="mt-3 space-y-1 text-sm text-slate-700">
                    {points.map((t) => <li key={t}><span aria-hidden="true" className="text-slate-400 mr-1.5">✓</span>{t}</li>)}
                  </ul>
                </div>
              </div>

              {p.total > 0 ? (
                <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between"><span>초안</span><span className="tabular-nums">{p.drafted} / {p.total}</span></div>
                  <Bar value={p.drafted} total={p.total} cls={tone.bar} />
                  <div className="flex justify-between"><span>검토 완료</span><span className="tabular-nums">{p.reviewed} / {p.total}</span></div>
                  <Bar value={p.reviewed} total={p.total} cls={tone.bar} />
                </div>
              ) : (
                <p className="mt-4 text-xs text-slate-400">진행률은 준비가 끝나면 보여요.</p>
              )}

              {missing.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {missing.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-amber-800">빠짐: {m.label}</span>
                      <button type="button" className="text-indigo-700 underline" onClick={() => go(m.go)}>{m.label} 넣기</button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-auto pt-4 flex justify-end">
                <button type="button" disabled={state.students.length === 0} onClick={() => goTo("작업", sec)} aria-label={`${short} 작업하기`}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${tone.pill}`}>
                  바로 시작 →
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {!next && checklist}
    </>
  );
}
