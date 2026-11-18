import { useCallback, useState } from "react";
import { AppStateProvider, useApp } from "./state.jsx";
import Home from "./screens/Home.jsx";
import Students from "./screens/Students.jsx";
import Work from "./screens/Work.jsx";
import Backup from "./screens/Backup.jsx";
import Settings from "./screens/Settings.jsx";
import Guide from "./screens/Guide.jsx";

const SCREENS = { 홈: Home, 학생: Students, 작업: Work, 백업: Backup, 설정: Settings, 사용법: Guide };
export const TABS = ["홈", "학생", "작업", "백업", "설정", "사용법"];

function SaveWarning() {
  const { saveFailed } = useApp();
  if (!saveFailed) return null;
  return (
    <div className="bg-red-600 text-white text-sm text-center py-2">
      브라우저에 저장하지 못했어요. 저장 공간이 꽉 찼거나 시크릿 창일 수 있어요. 백업을 내려받아 두세요.
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("홈");
  // 화면마다 "어디로 와서 무엇을 열지" (예: 설정의 평가계획, 작업의 교과). n은 같은 곳을 다시 눌러도 반응하게 한다.
  const [focus, setFocus] = useState({});
  const goTo = useCallback((t, value) => {
    setTab(t);
    setFocus((prev) => ({ ...prev, [t]: { value: value ?? null, n: (prev[t]?.n || 0) + 1 } }));
  }, []);

  return (
    <AppStateProvider goTo={goTo}>
      <div className="min-h-screen">
        <SaveWarning />
        <header className="bg-white/90 backdrop-blur border-b border-indigo-100 shadow-sm sticky top-0 z-10">
          <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <button type="button" onClick={() => goTo("홈")} className="flex items-center gap-2.5 text-left" aria-label="홈으로">
              <span aria-hidden="true" className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center text-lg shadow-sm">✍️</span>
              <span>
                <span className="block font-bold text-indigo-950 leading-tight">생기부 초안 도우미</span>
                <span className="block text-xs text-slate-500">칩만 고르면 AI가 생기부 초안을 써 드려요</span>
              </span>
            </button>
            <nav aria-label="메뉴" className="flex flex-wrap gap-1 sm:ml-auto">
              {TABS.map((t) => (
                <button key={t} type="button" onClick={() => goTo(t)} aria-current={tab === t ? "page" : undefined}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === t ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"}`}>
                  {t}
                </button>
              ))}
            </nav>
          </div>
        </header>
        {/* 모든 화면을 계속 띄워 두고 안 보이게만 한다: 반 전체 생성 중 다른 탭에 가도 진행·멈춤 버튼이 살아 있다 */}
        <main className={`mx-auto px-4 ${tab === "작업" ? "max-w-7xl py-3" : "max-w-5xl py-6"}`}>
          {TABS.map((t) => {
            const Screen = SCREENS[t];
            return (
              <div key={t} hidden={tab !== t}>
                <Screen focus={focus[t]} active={tab === t} />
              </div>
            );
          })}
        </main>
      </div>
    </AppStateProvider>
  );
}
