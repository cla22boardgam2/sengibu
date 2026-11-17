// 홈 체크리스트와 작업 화면 상태 표시용 계산. 상태(state)는 읽기만 한다.
import { AREAS } from "./defaults.js";
import { subjectsOf } from "./evalPlan.js";
import { buildRequest, draftKeyOf } from "./materials.js";

const hasActs = (state) => state.activities.some((a) => a.name?.trim());
const limitSet = (state, k) => state.settings.byteLimits?.[k] != null;

// 준비 단계. go는 이동할 곳: ["학생"] 또는 ["설정", 설정 섹션 id]
export function setupSteps(state) {
  return [
    { id: "students", label: "학생 명단", need: "필수", done: state.students.length > 0, go: ["학생"] },
    { id: "guide", label: "기재요령 발췌", need: "필수", done: !!state.settings.guideText.trim(), go: ["설정", "guide"] },
    { id: "limits", label: "바이트 상한", need: "필수", done: ["A", "B", "C"].every((k) => limitSet(state, k)), go: ["설정", "limits"] },
    { id: "plan", label: "평가계획", need: "교과", done: state.evalPlan.length > 0, go: ["설정", "plan"] },
    { id: "activities", label: "행사 목록", need: "창체", done: hasActs(state), go: ["설정", "activities"] },
    { id: "ai", label: "AI 연결", need: "선택", done: !!state.settings.geminiKey, go: ["설정", "ai"] },
  ];
}

const LIMIT_NAMES = { A: "교과 바이트 상한", B: "창체 바이트 상한", C: "행발 바이트 상한" };

// 한 항목을 쓰기 전에 빠진 것
export function sectionReadiness(state, section) {
  const missing = [];
  if (state.students.length === 0) missing.push({ id: "students", label: "학생 명단", go: ["학생"] });
  if (!state.settings.guideText.trim()) missing.push({ id: "guide", label: "기재요령 발췌", go: ["설정", "guide"] });
  if (section in LIMIT_NAMES && !limitSet(state, section)) {
    missing.push({ id: `limit${section}`, label: LIMIT_NAMES[section], go: ["설정", "limits"] });
  }
  if (section === "A" && state.evalPlan.length === 0) missing.push({ id: "plan", label: "평가계획", go: ["설정", "plan"] });
  if (section === "B" && !hasActs(state)) missing.push({ id: "activities", label: "행사 목록", go: ["설정", "activities"] });
  return { ready: missing.length === 0, missing };
}

// 한 학생·한 항목 상태: none 입력 없음 / input 입력됨 / draft 초안 있음 / need 보충 필요 / reviewed 검토 완료
export function studentStatus(state, pseudoId, section, opts = {}) {
  const entry = state.drafts[pseudoId]?.[draftKeyOf(section, opts)];
  if (entry?.draft != null && entry.draft !== "") {
    if (entry.reviewed) return "reviewed";
    if (String(entry.draft).includes("[보충 필요")) return "need";
    return "draft";
  }
  return buildRequest(state, pseudoId, section, opts).empty ? "none" : "input";
}

export const STATUS_INFO = {
  none: { icon: "○", label: "입력 없음", cls: "text-stone-300" },
  input: { icon: "◐", label: "입력됨", cls: "text-sky-600" },
  draft: { icon: "●", label: "초안 있음", cls: "text-emerald-600" },
  need: { icon: "!", label: "보충 필요", cls: "text-red-600 font-bold" },
  reviewed: { icon: "✓", label: "검토 완료", cls: "text-emerald-700 font-bold" },
};

// 진행률을 셀 단위: 교과는 교과마다, 창체는 행사가 있는 영역마다
export function unitsOf(state, section) {
  if (section === "A") return subjectsOf(state.evalPlan).map((subject) => ({ subject }));
  if (section === "B") return AREAS.filter((area) => state.activities.some((a) => a.area === area && a.name?.trim())).map((area) => ({ area }));
  return [{}];
}

export function sectionProgress(state, section) {
  const keys = unitsOf(state, section).map((o) => draftKeyOf(section, o));
  let drafted = 0;
  let reviewed = 0;
  for (const s of state.students) {
    for (const k of keys) {
      const e = state.drafts[s.pseudoId]?.[k];
      if (e?.draft) drafted += 1;
      if (e?.draft && e.reviewed) reviewed += 1;
    }
  }
  return { total: state.students.length * keys.length, drafted, reviewed };
}
