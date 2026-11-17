import { useEffect, useRef } from "react";
import { STATUS_INFO } from "../../lib/progress.js";

export default function StudentList({ students, statuses, selected, onSelect }) {
  const box = useRef(null);
  useEffect(() => {
    box.current?.querySelector('[aria-current="true"]')?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);

  const counts = Object.fromEntries(Object.keys(STATUS_INFO).map((k) => [k, 0]));
  for (const s of students) counts[statuses[s.pseudoId]] += 1;

  return (
    <aside aria-label="학생 목록" className="bg-white border border-stone-200 rounded-xl flex flex-col min-h-0 max-h-72 lg:max-h-none">
      <ul ref={box} className="overflow-auto flex-1 p-1.5">
        {students.map((s) => {
          const info = STATUS_INFO[statuses[s.pseudoId]];
          const on = s.pseudoId === selected;
          return (
            <li key={s.pseudoId}>
              <button type="button" aria-current={on ? "true" : undefined} onClick={() => onSelect(s.pseudoId)}
                aria-label={`${s.number}번 ${s.name} · ${info.label}`} title={info.label}
                className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-left ${on ? "bg-emerald-700 text-white" : "hover:bg-stone-100"}`}>
                <span aria-hidden="true" className={`w-4 text-center ${on ? "text-white" : info.cls}`}>{info.icon}</span>
                <span className="tabular-nums text-xs opacity-70 w-5">{s.number}</span>
                <span className="truncate">{s.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-stone-100 px-2 py-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-stone-500">
        {Object.entries(STATUS_INFO).map(([k, v]) => (
          <span key={k} className="whitespace-nowrap"><span aria-hidden="true" className={v.cls}>{v.icon}</span> {v.label} {counts[k]}</span>
        ))}
      </div>
    </aside>
  );
}
