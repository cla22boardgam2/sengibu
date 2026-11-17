import { useState } from "react";
import { AppStateProvider, useApp } from "./state.jsx";
import { loadState } from "./lib/store.js";
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
// 설정은 탭 줄이 아니라 오른쪽 톱니바퀴로 연다
const NAV_TABS = TABS.filter((t) => t !== "설정");

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

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
  const [tab, setTab] = useState(() => (loadState().students.length ? "학생" : "설정"));
  return (
    <AppStateProvider goTo={setTab}>
      <div className="min-h-screen">
        <SaveWarning />
        <header className="border-b bg-white sticky top-0 z-10">
          <div className="mx-auto max-w-5xl px-4 py-3 flex flex-wrap items-center gap-2">
            <h1 className="font-bold text-emerald-800 mr-4">생기부 초안 도우미</h1>
            <nav className="flex flex-wrap gap-1 order-last w-full sm:order-none sm:w-auto">
              {NAV_TABS.map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-full text-sm ${tab === t ? "bg-emerald-700 text-white" : "text-stone-600 hover:bg-stone-100"}`}>
                  {t}
                </button>
              ))}
            </nav>
            <button type="button" onClick={() => setTab("설정")} aria-label="설정" title="설정" aria-pressed={tab === "설정"}
              className={`ml-auto sm:order-last p-2 rounded-full ${tab === "설정" ? "bg-emerald-700 text-white" : "text-stone-500 hover:bg-stone-100"}`}>
              <GearIcon />
            </button>
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
