export function pseudoIdOf(seq) {
  return `S${String(seq).padStart(2, "0")}`;
}

function renumber(students) {
  return students.map((s, i) => ({ ...s, number: i + 1 }));
}

export function addStudents(state, names) {
  let seq = state.nextStudentSeq;
  const added = names
    .map((n) => String(n ?? "").trim())
    .filter(Boolean)
    .map((name) => ({ pseudoId: pseudoIdOf(seq++), number: 0, name }));
  return { ...state, students: renumber([...state.students, ...added]), nextStudentSeq: seq };
}

export function removeStudent(state, pseudoId) {
  const inputs = { ...state.inputs };
  const drafts = { ...state.drafts };
  delete inputs[pseudoId];
  delete drafts[pseudoId];
  return { ...state, students: renumber(state.students.filter((s) => s.pseudoId !== pseudoId)), inputs, drafts };
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// 실명 → 가명 (긴 이름부터 바꿔 "김지수"가 "김S01"이 되지 않게)
export function scrubNames(text, students) {
  let out = String(text ?? "");
  let count = 0;
  const list = students.filter((s) => s.name).slice().sort((a, b) => b.name.length - a.name.length);
  for (const s of list) {
    out = out.replace(new RegExp(escapeRe(s.name), "g"), () => {
      count += 1;
      return s.pseudoId;
    });
  }
  return { text: out, count };
}

// 가명 → 실명 (화면 표시용). S1이 S10을 건드리지 않게 숫자 경계를 본다.
export function toRealNames(text, students) {
  const map = new Map(students.map((s) => [s.pseudoId, s.name]));
  return String(text ?? "").replace(/S\d{2,}(?!\d)/g, (id) => map.get(id) ?? id);
}

export function firstWord(draft) {
  const t = String(draft ?? "").trim();
  if (!t || t.startsWith("[보충 필요")) return "";
  return t.split(/\s+/)[0];
}
