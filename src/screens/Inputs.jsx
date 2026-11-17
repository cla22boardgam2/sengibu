import { useState } from "react";
import { useApp } from "../state.jsx";
import { subjectsOf } from "../lib/evalPlan.js";
import { AREAS } from "../lib/defaults.js";
import { draftKeyOf, findSameMaterial } from "../lib/materials.js";
import { todayStr } from "../lib/date.js";
import ChipPicker from "../components/ChipPicker.jsx";
import GradeButtons from "../components/GradeButtons.jsx";
import MemoList from "../components/MemoList.jsx";
import { Card, Button, Notice, EmptyHint } from "../components/ui.jsx";

const SECTIONS = [["A", "교과"], ["B", "창체"], ["C", "행발"]];

// 학생 한 명의 입력을 바꾸는 도우미
const patchInput = (s, pid, fn) => ({ ...s, inputs: { ...s.inputs, [pid]: fn(s.inputs[pid] || {}) } });

export function sameMaterialText(groups, students) {
  const num = (pid) => students.find((s) => s.pseudoId === pid)?.number;
  return groups.map((g) => {
    const nums = g.map((p) => `${num(p)}번`);
    const who = nums.length === 2 ? `${nums[0]}과 ${nums[1]}` : nums.join(", ");
    return `${who}의 재료가 같아요. 메모를 한 줄 더하면 달라져요.`;
  });
}

function Tabs({ items, value, onChange, small }) {
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

export default function Inputs() {
  const { state, update, goTo } = useApp();
  const [section, setSection] = useState("C");
  const subjects = subjectsOf(state.evalPlan);
  const [subjectSel, setSubject] = useState(null);
  const [area, setArea] = useState(AREAS[1]);
  const subject = subjects.includes(subjectSel) ? subjectSel : subjects[0];

  const opts = section === "A" ? { subject } : section === "B" ? { area } : {};
  const memoKey = draftKeyOf(section, opts);

  if (state.students.length === 0) {
    return <EmptyHint action={<Button onClick={() => goTo("학생")}>학생 넣으러 가기</Button>}>먼저 학생을 넣어 주세요.</EmptyHint>;
  }

  const rows = state.evalPlan.filter((r) => r.subject === subject);
  const acts = state.activities.filter((a) => a.area === area);
  const missingSetup =
    (section === "A" && subjects.length === 0 && "설정에서 평가계획을 먼저 넣어 주세요.") ||
    (section === "B" && state.activities.length === 0 && "설정에서 행사 목록을 먼저 넣어 주세요.");

  const same = missingSetup ? [] : sameMaterialText(findSameMaterial(state, section, opts), state.students);

  const toggleChipC = (pid, id) =>
    update((s) => patchInput(s, pid, (inp) => {
      const chipsC = { ...(inp.chipsC || {}) };
      if (chipsC[id]) delete chipsC[id]; else chipsC[id] = todayStr();
      return { ...inp, chipsC };
    }));

  const setGrade = (pids, rowId, level) =>
    update((s) => pids.reduce((acc, pid) => patchInput(acc, pid, (inp) => {
      const grades = { ...(inp.grades || {}) };
      if (!level) delete grades[rowId];
      else grades[rowId] = { level, date: grades[rowId]?.level === level ? grades[rowId].date : todayStr() };
      return { ...inp, grades };
    }), s));

  const setAct = (pids, actId, fn) =>
    update((s) => pids.reduce((acc, pid) => patchInput(acc, pid, (inp) => {
      const cur = inp.acts?.[actId] || { joined: true, roles: {} };
      return { ...inp, acts: { ...(inp.acts || {}), [actId]: fn(cur) } };
    }), s));

  const toggleRole = (pid, actId, chipId) =>
    setAct([pid], actId, (cur) => {
      const roles = { ...cur.roles };
      if (roles[chipId]) delete roles[chipId]; else roles[chipId] = todayStr();
      return { ...cur, roles };
    });

  const setMemos = (pid, memos) =>
    update((s) => patchInput(s, pid, (inp) => ({ ...inp, memos: { ...(inp.memos || {}), [memoKey]: memos } })));

  const allPids = state.students.map((s) => s.pseudoId);

  return (
    <>
      <Tabs items={SECTIONS} value={section} onChange={setSection} />
      {section === "A" && subjects.length > 0 && (
        <Tabs small items={subjects.map((s) => [s, s])} value={subject} onChange={setSubject} />
      )}
      {section === "B" && <Tabs small items={AREAS.map((a) => [a, a])} value={area} onChange={setArea} />}

      {missingSetup ? (
        <EmptyHint action={<Button onClick={() => goTo("설정")}>설정으로 가기</Button>}>{missingSetup}</EmptyHint>
      ) : (
        <>
          {section === "A" && (
            <Card title="반 전체 같은 등급" desc="대부분 같은 등급이면 여기서 한 번에 고르고, 다른 학생만 아래에서 바꾸세요.">
              <div className="space-y-2">
                {rows.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-40 truncate" title={r.element}>{r.element}</span>
                    <GradeButtons row={r} label={`반 전체 · ${r.element}`}
                      onChange={(lv) => lv && window.confirm(`모든 학생의 '${r.element}' 등급을 바꿀까요?`) && setGrade(allPids, r.id, lv)} />
                  </div>
                ))}
              </div>
            </Card>
          )}
          {section === "B" && acts.length > 0 && (
            <div className="flex gap-2 mb-3">
              {acts.map((a) => (
                <span key={a.id} className="text-xs text-stone-600">
                  {a.name}:
                  <button type="button" className="underline mx-1" onClick={() => setAct(allPids, a.id, (c) => ({ ...c, joined: true }))}>모두 참여</button>
                  <button type="button" className="underline" onClick={() => setAct(allPids, a.id, (c) => ({ ...c, joined: false }))}>모두 빼기</button>
                </span>
              ))}
            </div>
          )}
          {section === "B" && acts.length === 0 && <Notice tone="warn">이 영역에 넣은 행사가 없어요. 설정의 행사 목록에서 영역을 확인해 주세요.</Notice>}

          {same.length > 0 && (
            <div className="mb-3 space-y-1">{same.map((t) => <Notice key={t} tone="warn">{t}</Notice>)}</div>
          )}

          {state.students.map((st) => {
            const inp = state.inputs[st.pseudoId] || {};
            return (
              <section key={st.pseudoId} aria-label={`${st.number}번 학생`} className="bg-white border border-stone-200 rounded-xl p-4 mb-3">
                <div className="font-semibold text-stone-800 mb-2">{st.number}. {st.name}</div>
                {section === "A" && (
                  <div className="space-y-1.5">
                    {rows.map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="w-40 truncate text-stone-600" title={r.element}>{r.element}</span>
                        <GradeButtons row={r} value={inp.grades?.[r.id]?.level} onChange={(lv) => setGrade([st.pseudoId], r.id, lv)} />
                      </div>
                    ))}
                  </div>
                )}
                {section === "B" && acts.map((a) => {
                  const cur = inp.acts?.[a.id] || { joined: true, roles: {} };
                  return (
                    <div key={a.id} className="mb-2">
                      <label className="text-sm flex items-center gap-2 mb-1">
                        <input type="checkbox" checked={cur.joined !== false}
                          onChange={(e) => setAct([st.pseudoId], a.id, (c) => ({ ...c, joined: e.target.checked }))} />
                        {a.name} <span className="text-stone-400 text-xs">{a.desc}</span>
                      </label>
                      {cur.joined !== false && (
                        <ChipPicker chips={state.chips.B} selected={cur.roles} onToggle={(id) => toggleRole(st.pseudoId, a.id, id)} />
                      )}
                    </div>
                  );
                })}
                {section === "C" && (
                  <ChipPicker chips={state.chips.C} groupBy selected={inp.chipsC} onToggle={(id) => toggleChipC(st.pseudoId, id)} />
                )}
                <MemoList memos={inp.memos?.[memoKey] || []} onChange={(m) => setMemos(st.pseudoId, m)} />
              </section>
            );
          })}
        </>
      )}
    </>
  );
}
