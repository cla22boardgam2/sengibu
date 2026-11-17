import { useState } from "react";

const uid = () => Math.random().toString(36).slice(2, 9);
const byDate = (a, b) => (a.date || "9999") < (b.date || "9999") ? -1 : (a.date || "9999") > (b.date || "9999") ? 1 : 0;

export default function MemoList({ memos = [], onChange }) {
  const [date, setDate] = useState("");
  const [text, setText] = useState("");
  const add = () => {
    if (!text.trim()) return;
    onChange([...memos, { id: uid(), date, text: text.trim() }]);
    setText("");
  };
  const edit = (id, patch) => onChange(memos.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  return (
    <div className="mt-2">
      {memos.slice().sort(byDate).map((m) => (
        <div key={m.id} className="flex gap-1.5 items-center mb-1">
          <input type="date" value={m.date} onChange={(e) => edit(m.id, { date: e.target.value })}
            className="border border-stone-200 rounded px-1.5 py-1 text-xs w-32" aria-label="메모 날짜 고치기" />
          <input value={m.text} onChange={(e) => edit(m.id, { text: e.target.value })}
            className="flex-1 border border-stone-200 rounded px-2 py-1 text-xs" aria-label="메모 고치기" />
          <button type="button" className="text-xs text-stone-400 hover:text-red-600 px-1" aria-label="메모 삭제"
            onClick={() => onChange(memos.filter((x) => x.id !== m.id))}>×</button>
        </div>
      ))}
      <div className="flex gap-1.5 items-center">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="border border-stone-300 rounded px-1.5 py-1 text-xs w-32" aria-label="메모 날짜" />
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="칩으로 안 되는 관찰 (날짜는 선택)" className="flex-1 border border-stone-300 rounded px-2 py-1 text-xs" aria-label="메모 내용" />
        <button type="button" onClick={add} className="text-xs px-2 py-1 rounded border border-stone-300 hover:bg-stone-100">메모 추가</button>
      </div>
      <p className="text-[11px] text-stone-400 mt-1">이름·연락처·건강·가정 정보는 쓰지 마세요.</p>
    </div>
  );
}
