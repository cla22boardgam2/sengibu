import { useState } from "react";
import { AppStateProvider, useApp } from "./state.jsx";
import Settings from "./screens/Settings.jsx";
import Students from "./screens/Students.jsx";
import Backup from "./screens/Backup.jsx";
import Inputs from "./screens/Inputs.jsx";
import Generate from "./screens/Generate.jsx";
import Review from "./screens/Review.jsx";

const SCREENS = {
  설정: Settings,
  학생: Students,
  입력: Inputs,
  "초안 만들기": Generate,
  "결과 검토": Review,
  백업: Backup,
};
export const TABS = ["설정", "학생", "입력", "초안 만들기", "결과 검토", "백업"];

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
  const [tab, setTab] = useState(TABS[0]);
  return (
    <AppStateProvider goTo={setTab}>
      <div className="min-h-screen">
        <SaveWarning />
        <header className="border-b bg-white sticky top-0 z-10">
          <div className="mx-auto max-w-5xl px-4 py-3 flex flex-wrap items-center gap-2">
            <h1 className="font-bold text-emerald-800 mr-4">생기부 초안 도우미</h1>
            <nav className="flex flex-wrap gap-1">
              {TABS.map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-full text-sm ${tab === t ? "bg-emerald-700 text-white" : "text-stone-600 hover:bg-stone-100"}`}>
                  {t}
                </button>
              ))}
            </nav>
          </div>
        </header>
        {/* 모든 화면을 계속 띄워 두고 안 보이게만 한다: 반 전체 생성 중 다른 탭에 가도 진행·멈춤 버튼이 살아 있다 */}
        <main className="mx-auto max-w-5xl px-4 py-6">
          {TABS.map((t) => {
            const Screen = SCREENS[t];
            return (
              <div key={t} hidden={tab !== t}>
                <Screen />
              </div>
            );
          })}
        </main>
      </div>
    </AppStateProvider>
  );
}
