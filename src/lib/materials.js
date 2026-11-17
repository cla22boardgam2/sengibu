import { LEVEL_NAMES } from "./defaults.js";
import { scrubNames, firstWord } from "./students.js";

const LENGTH_NAMES = { short: "짧게", normal: "보통", long: "길게" };

export function draftKeyOf(section, opts = {}) {
  if (section === "A") return `A:${opts.subject}`;
  if (section === "B") return `B:${opts.area}`;
  return section;
}

// D(통지표)는 행발 메모를 함께 쓴다
const memoKeyOf = (section, opts) => (section === "D" ? "C" : draftKeyOf(section, opts));

const gradeText = (row, level) =>
  `평가: ${row.element} (${row.code}) — ${LEVEL_NAMES[level]}: ${row.levels[level]}`;

function gradeLogs(state, inp, subject, withSubject) {
  return state.evalPlan
    .filter((row) => (subject ? row.subject === subject : true))
    .filter((row) => inp.grades?.[row.id]?.level)
    .map((row) => {
      const { level, date } = inp.grades[row.id];
      return { date: date || "", text: (withSubject ? `${row.subject} ` : "") + gradeText(row, level) };
    });
}

function chipLogs(state, inp) {
  return state.chips.C
    .filter((c) => inp.chipsC?.[c.id])
    .map((c) => ({ date: inp.chipsC[c.id], text: `칩: ${c.text}` }));
}

function activityLogs(state, inp, area) {
  return state.activities
    .filter((a) => a.area === area)
    .filter((a) => inp.acts?.[a.id]?.joined !== false)
    .map((a) => {
      const roles = inp.acts?.[a.id]?.roles || {};
      const picked = state.chips.B.filter((c) => roles[c.id]);
      const dates = picked.map((c) => roles[c.id]).filter(Boolean).sort();
      const names = picked.map((c) => c.text).join(", ") || "기록 없음";
      return { date: dates[0] || "", text: `참여: ${a.name} — 역할: ${names}` };
    });
}

// 학생 한 명·한 항목의 원재료 (가명 치환 전)
function collect(state, pseudoId, section, opts) {
  const inp = state.inputs[pseudoId] || {};
  let logs = [];
  if (section === "A") logs = gradeLogs(state, inp, opts.subject, false);
  else if (section === "B") logs = activityLogs(state, inp, opts.area);
  else if (section === "C") logs = chipLogs(state, inp);
  else if (section === "D") logs = [...gradeLogs(state, inp, null, true), ...chipLogs(state, inp)];

  const memos = inp.memos?.[memoKeyOf(section, opts)] || [];
  const dated = memos.filter((m) => m.date && m.text?.trim()).map((m) => ({ date: m.date, text: m.text.trim() }));
  const undated = memos.filter((m) => !m.date && m.text?.trim()).map((m) => m.text.trim());
  logs = [...logs, ...dated];
  // 기록이 하나도 없고 날짜 없는 메모만 있으면, 메모를 관찰 기록으로 쓴다
  if (logs.length === 0 && undated.length > 0) {
    return { logs: undated.map((text) => ({ date: "", text })), notes: [] };
  }
  return { logs, notes: undated };
}

const byDate = (a, b) => {
  if (!a.date && !b.date) return 0;
  if (!a.date) return 1;
  if (!b.date) return -1;
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
};

function evalPlanDoc(rows) {
  return rows
    .map((r) => {
      const lv = ["vg", "g", "n", "e"]
        .filter((k) => r.levels[k])
        .map((k) => `${LEVEL_NAMES[k]}: ${r.levels[k]}`)
        .join(" / ");
      return `- ${r.subject} | ${r.area} | ${r.code} | ${r.element} | ${lv}`;
    })
    .join("\n");
}

function activitiesDoc(activities) {
  return activities.map((a) => `- ${a.area} | ${a.name} | ${a.desc || ""}`).join("\n");
}

function extraDocsOf(state, section, opts) {
  const parts = [];
  if (section === "A") {
    const rows = state.evalPlan.filter((r) => r.subject === opts.subject);
    if (rows.length) parts.push(`[성취기준·평가기준 — ${opts.subject}]\n${evalPlanDoc(rows)}`);
  }
  if (section === "B" && state.activities.length) {
    parts.push(`[학교 교육활동 목록]\n${activitiesDoc(state.activities)}`);
  }
  if (section === "D") {
    if (state.evalPlan.length) parts.push(`[성취기준·평가기준]\n${evalPlanDoc(state.evalPlan)}`);
    if (state.settings.hasSchoolGuide && state.settings.reportGuideText.trim()) {
      parts.push(`[학교 통지표 지침]\n${state.settings.reportGuideText.trim()}`);
    }
  }
  return parts.join("\n\n");
}

function optsOf(state, section, opts) {
  if (section === "A") return { subject: opts.subject, grade: state.settings.grade };
  if (section === "B") return { area: opts.area };
  if (section === "D") return { maxChars: state.settings.reportMaxChars, hasSchoolGuide: !!state.settings.hasSchoolGuide };
  return {};
}

function usedOpeningsOf(state, pseudoId, key) {
  const out = [];
  for (const [pid, drafts] of Object.entries(state.drafts)) {
    if (pid === pseudoId) continue;
    const w = firstWord(drafts?.[key]?.draft);
    if (w && !out.includes(w)) out.push(w);
  }
  return out;
}

function otherDraftsOf(state, pseudoId, key) {
  const out = {};
  for (const [k, d] of Object.entries(state.drafts[pseudoId] || {})) {
    if (k === key) continue;
    const text = String(d?.draft ?? "").trim();
    if (!text || text.startsWith("[보충 필요")) continue;
    const letter = k.split(":")[0];
    out[letter] = out[letter] ? `${out[letter]}\n${text}` : text;
  }
  return out;
}

export function buildRequest(state, pseudoId, section, opts = {}) {
  const key = draftKeyOf(section, opts);
  const { logs, notes } = collect(state, pseudoId, section, opts);
  let scrubbed = 0;
  const scrub = (t) => {
    const r = scrubNames(t, state.students);
    scrubbed += r.count;
    return r.text;
  };

  const memoLines = [...notes, `분량: ${LENGTH_NAMES[state.settings.length] || "보통"}`];
  if (state.settings.classNote?.trim()) memoLines.push(state.settings.classNote.trim());

  const student = {
    pseudoId,
    grade: state.settings.grade,
    logs: logs.slice().sort(byDate).map((l) => ({ date: l.date, text: scrub(l.text) })),
    usedOpenings: usedOpeningsOf(state, pseudoId, key),
    otherDrafts: otherDraftsOf(state, pseudoId, key),
    memo: scrub(memoLines.join("\n")),
  };

  return {
    section,
    opts: optsOf(state, section, opts),
    student,
    guideText: state.settings.guideText,
    extraDocs: extraDocsOf(state, section, opts),
    scrubbed,
    empty: logs.length === 0,
  };
}

// 같은 항목에서 재료(기록 문구 + 메모)가 완전히 같은 학생 묶음
export function findSameMaterial(state, section, opts = {}) {
  const groups = new Map();
  for (const s of state.students) {
    const { logs, notes } = collect(state, s.pseudoId, section, opts);
    if (logs.length === 0) continue;
    const sig = JSON.stringify([logs.map((l) => l.text).sort(), notes.slice().sort()]);
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig).push(s.pseudoId);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}
