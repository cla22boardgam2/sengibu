import { useState } from "react";

const TABS = ["설정", "학생", "입력", "초안 만들기", "결과 검토", "백업"];

export default function App() {
  const [tab, setTab] = useState(TABS[0]);
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-4 py-3 flex flex-wrap items-center gap-2">
          <h1 className="font-bold text-emerald-800 mr-4">생기부 초안 도우미</h1>
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-sm ${tab === t ? "bg-emerald-700 text-white" : "text-stone-600 hover:bg-stone-100"}`}>
              {t}
            </button>
          ))}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{tab}</main>
    </div>
  );
}
