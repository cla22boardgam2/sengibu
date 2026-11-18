import { useState } from "react";
import { CHIP_GROUPS, LEVEL_NAMES } from "../../lib/defaults.js";
import { todayStr } from "../../lib/date.js";
import ChipPicker from "../../components/ChipPicker.jsx";
import GradeButtons from "../../components/GradeButtons.jsx";
import MemoList from "../../components/MemoList.jsx";
import { Notice, Button } from "../../components/ui.jsx";

// 학생 한 명의 입력을 바꾸는 도우미 (데이터 구조는 예전 입력 화면과 같다)
export const patchInput = (s, pid, fn) => ({ ...s, inputs: { ...s.inputs, [pid]: fn(s.inputs[pid] || {}) } });

export function inputActions(update) {
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
  const setMemos = (pid, memoKey, memos) =>
    update((s) => patchInput(s, pid, (inp) => ({ ...inp, memos: { ...(inp.memos || {}), [memoKey]: memos } })));
  return { toggleChipC, setGrade, setAct, toggleRole, setMemos };
}

const chipUid = () => `k-${Math.random().toString(36).slice(2, 9)}`;

// 행발 칩 목록 고치기 (작업 화면에서 바로)
export function chipActions(update) {
  const setC = (fn) => update((s) => ({ ...s, chips: { ...s.chips, C: fn(s.chips.C) } }));
  return {
    rename: (id, text) => setC((C) => C.map((c) => (c.id === id ? { ...c, text } : c))),
    remove: (id) => setC((C) => C.filter((c) => c.id !== id)),
    add: (group, sub, text) =>
      setC((C) => (C.some((c) => c.text === text) ? C : [...C, { id: chipUid(), group, sub, text, negative: group === "노력할 점" }])),
  };
}

function AddChip({ label, onAdd }) {
  const [text, setText] = useState("");
  const add = () => { if (text.trim()) { onAdd(text.trim()); setText(""); } };
  return (
    <input aria-label={label} value={text} placeholder="+ 칩 추가 (Enter)"
      onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} onBlur={add}
      className="border border-dashed border-slate-300 rounded-full px-2.5 py-1 text-xs w-44 bg-white" />
  );
}

// 행발 칩: 고른 칩 요약 + 큰 분류 접기 > 소분류 > 칩. [칩 편집]으로 그 자리에서 고친다.
function ChipBoard({ state, chips, selected = {}, onToggle, openGroups, setOpenGroups, edit }) {
  const [editing, setEditing] = useState(false);
  const picked = chips.filter((c) => selected[c.id]);
  const groups = [...new Set([...CHIP_GROUPS, ...chips.map((c) => c.group)])].filter((g) => chips.some((c) => c.group === g));
  const flip = (g) => setOpenGroups((o) => ({ ...o, [g]: !o[g] }));
  const usedBy = (id) => Object.values(state.inputs).filter((inp) => inp?.chipsC?.[id]).length;
  const remove = (c) => {
    const n = usedBy(c.id);
    if (window.confirm(n ? `'${c.text}' 칩을 ${n}명이 골랐어요. 지우면 그 학생들 재료에서도 빠져요. 지울까요?` : `'${c.text}' 칩을 지울까요?`)) edit.remove(c.id);
  };
  return (
    <div>
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-2 mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500">고른 칩 {picked.length}개</span>
          <button type="button" onClick={() => setEditing((v) => !v)}
            className={`text-xs rounded-full px-2.5 py-0.5 ${editing ? "bg-indigo-600 text-white" : "border border-slate-300 text-slate-600 hover:bg-white"}`}>
            {editing ? "편집 끝" : "칩 편집"}
          </button>
        </div>
        {picked.length === 0 ? (
          <p className="text-xs text-slate-400">아래 분류를 펼쳐 골라 주세요.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {picked.map((c) => (
              <button key={c.id} type="button" aria-label={`${c.text} 빼기`} onClick={() => onToggle(c.id)}
                className={`rounded-full px-2.5 py-1 text-xs text-white ${c.negative ? "bg-amber-500" : "bg-indigo-700"}`}>
                {c.text} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1">
        {groups.map((g) => {
          const list = chips.filter((c) => c.group === g);
          const n = list.filter((c) => selected[c.id]).length;
          const open = !!openGroups[g];
          return (
            <div key={g} className="border border-slate-200 rounded-lg">
              <button type="button" aria-expanded={open} onClick={() => flip(g)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-sm">
                <span className={g === "노력할 점" ? "text-amber-800" : "text-slate-700"}>{g}</span>
                <span className="text-xs text-slate-400">{n > 0 ? `${n}개 고름 · ` : ""}{open ? "접기 ▲" : "펼치기 ▼"}</span>
              </button>
              {open && (
                <div className="px-3 pb-2 space-y-2">
                  {[...new Set(list.map((c) => c.sub || "기타"))].map((sub) => {
                    const subList = list.filter((c) => (c.sub || "기타") === sub);
                    return (
                      <div key={sub} role="group" aria-label={`${g} · ${sub}`}>
                        <div className="text-[11px] font-semibold text-slate-400 mb-1">{sub}</div>
                        {editing ? (
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {subList.map((c) => (
                              <span key={c.id} className="inline-flex items-center gap-0.5 rounded-full border border-slate-300 bg-white pl-2 pr-1 py-0.5">
                                <input aria-label={`칩 이름: ${c.text}`} value={c.text}
                                  onChange={(e) => e.target.value.trim() && edit.rename(c.id, e.target.value)}
                                  className="text-xs bg-transparent outline-none" style={{ width: `${Math.max(4, c.text.length + 1)}em` }} />
                                <button type="button" aria-label={`${c.text} 지우기`} onClick={() => remove(c)}
                                  className="text-slate-400 hover:text-red-600 px-1 text-xs">✕</button>
                              </span>
                            ))}
                            <AddChip label={`${g} · ${sub}에 칩 추가`} onAdd={(t) => edit.add(g, sub, t)} />
                          </div>
                        ) : (
                          <ChipPicker chips={subList} selected={selected} onToggle={onToggle} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function StudentInput({ state, st, section, opts, memoKey, acts, rows, sameText, actions, ui, goTo, setSection }) {
  const inp = state.inputs[st.pseudoId] || {};
  const pid = st.pseudoId;
  const allPids = state.students.map((s) => s.pseudoId);

  return (
    <section aria-label={`${st.number}번 학생`} className="space-y-3">
      <h2 className="font-semibold text-slate-800">{st.number}번 {st.name}</h2>

      {section === "A" && (
        rows.length === 0 ? (
          <Notice tone="warn">평가계획이 없어요. <button type="button" className="underline" onClick={() => goTo("설정", "plan")}>평가계획 넣기</button></Notice>
        ) : (
          <>
            <div className="space-y-1.5">
              {rows.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="flex-1 min-w-[8rem] text-slate-600" title={r.area}>{r.element}</span>
                  <GradeButtons row={r} value={inp.grades?.[r.id]?.level} onChange={(lv) => actions.setGrade([pid], r.id, lv)} />
                </div>
              ))}
            </div>
            <details className="text-sm border border-slate-200 rounded-lg px-3 py-1.5">
              <summary className="cursor-pointer text-slate-600">반 전체 같은 등급 한 번에 주기</summary>
              <p className="text-xs text-slate-500 my-1">대부분 같은 등급이면 여기서 고르고, 다른 학생만 따로 바꾸세요.</p>
              <div className="space-y-1.5 pb-1">
                {rows.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-2">
                    <span className="flex-1 min-w-[8rem] text-xs text-slate-600">{r.element}</span>
                    <GradeButtons row={r} label={`반 전체 · ${r.element}`}
                      onChange={(lv) => lv && window.confirm(`모든 학생의 '${r.element}' 등급을 ${LEVEL_NAMES[lv]}(으)로 바꿀까요?`) && actions.setGrade(allPids, r.id, lv)} />
                  </div>
                ))}
              </div>
            </details>
          </>
        )
      )}

      {section === "B" && (
        acts.length === 0 ? (
          <Notice tone="warn">{opts.area}에 넣은 행사가 없어요. <button type="button" className="underline" onClick={() => goTo("설정", "activities")}>행사 목록 넣기</button></Notice>
        ) : (
          <>
            {acts.map((a) => {
              const cur = inp.acts?.[a.id] || { joined: true, roles: {} };
              return (
                <div key={a.id} className="border border-slate-200 rounded-lg p-2">
                  <label className="text-sm flex items-center gap-2 mb-1">
                    <input type="checkbox" checked={cur.joined !== false}
                      onChange={(e) => actions.setAct([pid], a.id, (c) => ({ ...c, joined: e.target.checked }))} />
                    <span className="font-medium">{a.name}</span> <span className="text-slate-400 text-xs">{a.desc}</span>
                  </label>
                  {cur.joined !== false && (
                    <ChipPicker chips={state.chips.B} selected={cur.roles} onToggle={(id) => actions.toggleRole(pid, a.id, id)} />
                  )}
                </div>
              );
            })}
            <details className="text-sm border border-slate-200 rounded-lg px-3 py-1.5">
              <summary className="cursor-pointer text-slate-600">반 전체 참여 한 번에 바꾸기</summary>
              <div className="space-y-1 py-1">
                {acts.map((a) => (
                  <div key={a.id} className="text-xs text-slate-600">
                    {a.name}:
                    <button type="button" className="underline mx-1" onClick={() => actions.setAct(allPids, a.id, (c) => ({ ...c, joined: true }))}>모두 참여</button>
                    <button type="button" className="underline" onClick={() => actions.setAct(allPids, a.id, (c) => ({ ...c, joined: false }))}>모두 빼기</button>
                  </div>
                ))}
              </div>
            </details>
          </>
        )
      )}

      {section === "C" && (
        <ChipBoard state={state} chips={state.chips.C} selected={inp.chipsC} onToggle={(id) => actions.toggleChipC(pid, id)} edit={ui.chipEdit}
          openGroups={ui.openGroups} setOpenGroups={ui.setOpenGroups} />
      )}

      {section === "D" && (
        <div className="text-sm space-y-2">
          <Notice>통지표는 이 학생의 교과 등급, 행발 칩, 행발 메모를 모아서 써요. 따로 고를 것은 없어요.</Notice>
          <div className="text-xs text-slate-600">
            교과 등급 {Object.keys(inp.grades || {}).length}개 · 행발 칩 {Object.keys(inp.chipsC || {}).length}개
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSection("A")}>교과 등급 고르기</Button>
            <Button variant="ghost" onClick={() => setSection("C")}>행발 칩 고르기</Button>
          </div>
        </div>
      )}

      <div>
        <div className="text-xs text-slate-500">{section === "D" ? "행발 메모 (통지표와 함께 써요)" : "메모"}</div>
        <MemoList memos={inp.memos?.[memoKey] || []} onChange={(m) => actions.setMemos(pid, memoKey, m)} />
      </div>

      {sameText && <Notice tone="warn">{sameText}</Notice>}
    </section>
  );
}
