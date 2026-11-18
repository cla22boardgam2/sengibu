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

// 행발 칩: 고른 칩 요약 + 분류별 접기
function ChipBoard({ chips, selected = {}, onToggle, openGroups, setOpenGroups }) {
  const picked = chips.filter((c) => selected[c.id]);
  const groups = [...new Set([...CHIP_GROUPS, ...chips.map((c) => c.group)])].filter((g) => chips.some((c) => c.group === g));
  const flip = (g) => setOpenGroups((o) => ({ ...o, [g]: !o[g] }));
  return (
    <div>
      <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 mb-2">
        <div className="text-xs text-slate-500 mb-1">고른 칩 {picked.length}개</div>
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
              {open && <div className="px-3 pb-2"><ChipPicker chips={list} selected={selected} onToggle={onToggle} /></div>}
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
        <ChipBoard chips={state.chips.C} selected={inp.chipsC} onToggle={(id) => actions.toggleChipC(pid, id)}
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
