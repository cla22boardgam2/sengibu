import { useEffect, useRef, useState } from "react";
import { useApp } from "../state.jsx";
import { subjectsOf } from "../lib/evalPlan.js";
import { AREAS } from "../lib/defaults.js";
import { draftKeyOf, findSameMaterial } from "../lib/materials.js";
import { sectionReadiness, studentStatus } from "../lib/progress.js";
import { Button, EmptyHint } from "../components/ui.jsx";
import StudentList from "./work/StudentList.jsx";
import StudentInput, { inputActions } from "./work/StudentInput.jsx";
import DraftPane from "./work/DraftPane.jsx";
import BatchBar from "./work/BatchBar.jsx";

export const SECTION_TABS = [["A", "교과 평어"], ["B", "창체"], ["C", "행발"], ["D", "통지표"]];

function Pills({ items, value, onChange, small, label }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1">
      {items.map(([k, text]) => (
        <button key={k} role="tab" type="button" aria-selected={value === k} onClick={() => onChange(k)}
          className={`rounded-full ${small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${value === k ? "bg-slate-800 text-white" : "bg-white border border-slate-300 text-slate-700"}`}>
          {text}
        </button>
      ))}
    </div>
  );
}

export function sameMaterialText(group, students) {
  if (group.length > 3) {
    return `이 학생을 포함해 ${group.length}명의 재료(등급·칩·메모)가 똑같아요. 이대로면 문장이 비슷해질 수 있어요. 이 학생만의 모습을 메모로 한 줄 더하면 달라져요.`;
  }
  const nums = group.map((p) => `${students.find((s) => s.pseudoId === p)?.number}번`);
  const who = nums.length === 2 ? `${nums[0]}과 ${nums[1]}` : nums.join(", ");
  return `${who}의 재료가 같아요. 메모를 한 줄 더하면 달라져요.`;
}

const isTyping = (el) => !!el?.closest?.("input, textarea, select, [contenteditable='true']");

export default function Work({ focus, active }) {
  const { state, update, goTo } = useApp();
  const [section, setSection] = useState("C");
  useEffect(() => { if (focus?.value) setSection(focus.value); }, [focus]);

  const subjects = subjectsOf(state.evalPlan);
  const [subjectSel, setSubject] = useState(null);
  const subject = subjects.includes(subjectSel) ? subjectSel : subjects[0];
  const areasWithActs = AREAS.filter((a) => state.activities.some((x) => x.area === a && x.name?.trim()));
  const [areaSel, setArea] = useState(null);
  const area = areaSel ?? areasWithActs[0] ?? AREAS[0];

  const opts = section === "A" ? { subject } : section === "B" ? { area } : {};
  const keyName = draftKeyOf(section, opts);
  const memoKey = section === "D" ? "C" : keyName;
  const label = SECTION_TABS.find(([k]) => k === section)[1] + (section === "A" ? ` · ${subject ?? ""}` : section === "B" ? ` · ${area}` : "");

  const [pidSel, setPid] = useState(null);
  const [openGroups, setOpenGroups] = useState({});
  const [forceCopy, setForceCopy] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const students = state.students;
  const idx = Math.max(0, students.findIndex((s) => s.pseudoId === pidSel));
  const st = students[idx];
  const move = (d) => { const n = students[idx + d]; if (n) setPid(n.pseudoId); };

  // ← → 로 학생 넘기기 (글을 쓰는 중에는 무시)
  const moveRef = useRef(move);
  moveRef.current = move;
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); moveRef.current(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); moveRef.current(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  if (students.length === 0) {
    return <EmptyHint action={<Button onClick={() => goTo("학생")}>학생 넣으러 가기</Button>}>먼저 학생을 넣어 주세요.</EmptyHint>;
  }

  const canWork = (section !== "A" || !!subject);
  const statuses = Object.fromEntries(students.map((s) => [s.pseudoId, canWork ? studentStatus(state, s.pseudoId, section, opts) : "none"]));
  const inputPids = students.map((s) => s.pseudoId).filter((p) => statuses[p] !== "none");
  const { missing } = sectionReadiness(state, section);
  const hasKey = !!state.settings.geminiKey;
  const auto = hasKey && !forceCopy;
  const rows = state.evalPlan.filter((r) => r.subject === subject);
  const acts = state.activities.filter((a) => a.area === area && a.name?.trim());
  const group = canWork ? findSameMaterial(state, section, opts).find((g) => g.includes(st.pseudoId)) : null;
  const actions = inputActions(update);

  return (
    <div className="flex flex-col gap-2 lg:h-[calc(100vh-5.5rem)]">
      <div className="shrink-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Pills label="항목" items={SECTION_TABS} value={section} onChange={setSection} />
          {section === "A" && subjects.length > 0 && <Pills small label="교과" items={subjects.map((s) => [s, s])} value={subject} onChange={setSubject} />}
          {section === "B" && <Pills small label="영역" items={AREAS.map((a) => [a, a])} value={area} onChange={setArea} />}
        </div>
        {missing.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-1.5">
            <span>이 항목에 아직 빠진 것:</span>
            {missing.map((m) => (
              <button key={m.id} type="button" className="underline" onClick={() => goTo(...m.go)}>{m.label} 넣기</button>
            ))}
          </div>
        )}
        {canWork && (
          <BatchBar {...{ state, stateRef, update, section, opts, keyName, label, inputPids, auto, hasKey, forceCopy, setForceCopy, goTo }} />
        )}
      </div>

      <div className="flex-1 min-h-0 grid gap-3 lg:grid-cols-[11rem_minmax(0,1fr)_minmax(0,1fr)]">
        <StudentList students={students} statuses={statuses} selected={st.pseudoId} onSelect={setPid} />
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 p-4 overflow-auto min-h-0">
          <StudentInput {...{ state, st, section, opts, memoKey, acts, rows, actions, goTo, setSection }}
            sameText={group ? sameMaterialText(group, students) : ""} ui={{ openGroups, setOpenGroups }} />
        </div>
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 p-4 overflow-auto min-h-0">
          {canWork ? (
            <DraftPane {...{ state, st, section, opts, keyName, update, auto }} />
          ) : (
            <p className="text-sm text-slate-400">평가계획을 넣으면 초안을 쓸 수 있어요.</p>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => move(-1)} disabled={idx === 0}>← 이전 학생</Button>
        <span className="text-xs text-slate-500">{idx + 1} / {students.length} · 키보드 ← → 로도 넘길 수 있어요</span>
        <Button variant="ghost" onClick={() => move(1)} disabled={idx === students.length - 1}>다음 학생 →</Button>
      </div>
    </div>
  );
}
