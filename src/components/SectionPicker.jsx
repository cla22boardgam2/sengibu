import { useState } from "react";
import { subjectsOf } from "../lib/evalPlan.js";
import { AREAS } from "../lib/defaults.js";

export const SECTION_TABS = [["A", "교과 평어"], ["B", "창체"], ["C", "행발"], ["D", "통지표"]];

function Pills({ items, value, onChange, small }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 mb-3">
      {items.map(([k, label]) => (
        <button key={k} role="tab" type="button" aria-selected={value === k} onClick={() => onChange(k)}
          className={`rounded-full ${small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${value === k ? "bg-stone-800 text-white" : "bg-white border border-stone-300 text-stone-700"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

// 항목과 옵션(교과·영역)을 고른다. 고른 값은 { section, opts, ready } 로 돌려준다.
export function useSectionPicker(state) {
  const [section, setSection] = useState("C");
  const [subjectSel, setSubject] = useState(null);
  const [area, setArea] = useState(AREAS[1]);
  const subjects = subjectsOf(state.evalPlan);
  const subject = subjects.includes(subjectSel) ? subjectSel : subjects[0];
  const opts = section === "A" ? { subject } : section === "B" ? { area } : {};
  const ready = section !== "A" || !!subject;

  const picker = (
    <>
      <Pills items={SECTION_TABS} value={section} onChange={setSection} />
      {section === "A" && subjects.length > 0 && <Pills small items={subjects.map((s) => [s, s])} value={subject} onChange={setSubject} />}
      {section === "B" && <Pills small items={AREAS.map((a) => [a, a])} value={area} onChange={setArea} />}
    </>
  );
  return { section, opts, ready, picker };
}
