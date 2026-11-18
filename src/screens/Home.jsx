import { useApp } from "../state.jsx";
import { setupSteps, sectionReadiness, sectionProgress } from "../lib/progress.js";
import { Card, Button } from "../components/ui.jsx";

const NEED_STYLE = {
  필수: "bg-red-50 text-red-700 border-red-200",
  교과: "bg-sky-50 text-sky-700 border-sky-200",
  창체: "bg-violet-50 text-violet-700 border-violet-200",
  선택: "bg-stone-50 text-stone-500 border-stone-200",
};
const NEED_TEXT = { 필수: "필수", 교과: "교과 평어에 필요", 창체: "창체에 필요", 선택: "선택" };

const SECTIONS = [
  ["A", "교과 평어", "평가계획 등급으로 교과별 평어를 써요."],
  ["B", "창체", "행사 참여와 역할로 영역별 특기사항을 써요."],
  ["C", "행발", "성품·학습·친구 칩으로 종합의견을 써요."],
  ["D", "통지표", "교과 등급과 행발 칩을 모아 가정에 보낼 글을 써요."],
];

function Bar({ value, total }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
      <div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function Home() {
  const { state, goTo } = useApp();
  const steps = setupSteps(state);
  const next = steps.find((s) => !s.done && s.need === "필수");
  const go = (target) => goTo(...target);

  return (
    <>
      <Card title="시작 준비" desc="필수 3가지를 먼저 채우세요. 그다음 쓰려는 항목에 필요한 것만 채우면 돼요."
        right={<Button variant="ghost" onClick={() => goTo("사용법")}>사용법 보기</Button>}>
        <ol className="divide-y divide-stone-100">
          {steps.map((s, i) => (
            <li key={s.id} className={`flex items-center gap-3 py-2.5 ${next?.id === s.id ? "bg-emerald-50/60 -mx-2 px-2 rounded-lg" : ""}`}>
              <span aria-hidden="true"
                className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold ${s.done ? "bg-emerald-600 text-white" : "border-2 border-stone-300 text-stone-500"}`}>
                {s.done ? "✓" : i + 1}
              </span>
              <span className="flex-1 min-w-0">
                <span className="font-medium text-stone-800">{s.label}</span>
                <span className={`ml-2 text-[11px] border rounded-full px-2 py-0.5 align-middle ${NEED_STYLE[s.need]}`}>{NEED_TEXT[s.need]}</span>
              </span>
              <span className={`text-xs ${s.done ? "text-emerald-700" : "text-stone-400"}`}>{s.done ? "완료" : "아직"}</span>
              <Button variant={s.done ? "ghost" : "primary"} onClick={() => go(s.go)} aria-label={`${s.label} ${s.done ? "보기" : "하러 가기"}`}>
                {s.done ? "보기" : "하러 가기"}
              </Button>
            </li>
          ))}
        </ol>
        {next && <p className="text-sm text-emerald-800 mt-2">다음 할 일: <b>{next.label}</b></p>}
      </Card>

      <h2 className="font-semibold text-stone-800 mb-2">항목별 작업</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {SECTIONS.map(([sec, title, desc]) => {
          const { ready, missing } = sectionReadiness(state, sec);
          const p = sectionProgress(state, sec);
          return (
            <section key={sec} aria-label={`${title} 카드`} className="bg-white border border-stone-200 rounded-xl p-4 flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-stone-800">{title}</h3>
                <span className={`text-xs rounded-full px-2 py-0.5 ${ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                  {ready ? "준비 완료" : "준비 필요"}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5 mb-3">{desc}</p>
              {p.total > 0 ? (
                <div className="space-y-1.5 mb-3 text-xs text-stone-600">
                  <div className="flex justify-between"><span>초안</span><span className="tabular-nums">{p.drafted} / {p.total}</span></div>
                  <Bar value={p.drafted} total={p.total} />
                  <div className="flex justify-between"><span>검토 완료</span><span className="tabular-nums">{p.reviewed} / {p.total}</span></div>
                  <Bar value={p.reviewed} total={p.total} />
                </div>
              ) : (
                <p className="text-xs text-stone-400 mb-3">진행률은 준비가 끝나면 보여요.</p>
              )}
              {missing.length > 0 && (
                <ul className="mb-3 space-y-1">
                  {missing.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-amber-800">빠짐: {m.label}</span>
                      <button type="button" className="text-emerald-700 underline" onClick={() => go(m.go)}>{m.label} 넣기</button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto">
                <Button className="w-full" variant={ready ? "primary" : "ghost"} disabled={state.students.length === 0}
                  onClick={() => goTo("작업", sec)} aria-label={`${title} 작업하기`}>
                  작업하기
                </Button>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
