import { emptyState } from "../src/lib/defaults.js";
import { addStudents } from "../src/lib/students.js";
import { setupSteps, sectionReadiness, studentStatus, sectionProgress, unitsOf } from "../src/lib/progress.js";

const plan = [
  { id: "국어|1|토론", subject: "국어", area: "", code: "1", element: "토론", levels: { vg: "A", g: "B", n: "C", e: "D" } },
  { id: "수학|2|계산", subject: "수학", area: "", code: "2", element: "계산", levels: { vg: "A", g: "B", n: "C", e: "D" } },
];

function base() {
  return addStudents(emptyState(), ["가", "나"]);
}

test("준비 단계: 처음엔 학생·기재요령·상한(행발 1500만 있음)·평가계획·행사·AI 모두 미완료", () => {
  const steps = setupSteps(emptyState());
  expect(steps.map((s) => s.id)).toEqual(["students", "guide", "limits", "plan", "activities", "ai"]);
  expect(steps.map((s) => s.need)).toEqual(["필수", "필수", "필수", "교과", "창체", "선택"]);
  expect(steps.every((s) => !s.done)).toBe(true);
});

test("준비 단계: 채우면 완료로 바뀐다", () => {
  const s = base();
  s.settings.guideText = "요령";
  s.settings.byteLimits = { A: 1500, B: 1500, C: 1500 };
  s.evalPlan = plan;
  s.activities = [{ id: "a", area: "자율·자치활동", name: "학급회의", desc: "" }];
  s.settings.geminiKey = "k";
  expect(setupSteps(s).every((x) => x.done)).toBe(true);
});

test("항목 준비: 빠진 것을 알려 준다", () => {
  const s = base();
  expect(sectionReadiness(s, "A").missing.map((m) => m.id)).toEqual(["guide", "limitA", "plan"]);
  expect(sectionReadiness(s, "B").missing.map((m) => m.id)).toEqual(["guide", "limitB", "activities"]);
  expect(sectionReadiness(s, "C").missing.map((m) => m.id)).toEqual(["guide"]);
  expect(sectionReadiness(s, "D").missing.map((m) => m.id)).toEqual(["guide"]);
  s.settings.guideText = "요령";
  expect(sectionReadiness(s, "C").ready).toBe(true);
  expect(sectionReadiness(emptyState(), "C").missing[0].id).toBe("students");
});

test("학생 상태: 입력 없음 → 입력됨 → 초안 있음 → 보충 필요 / 검토 완료", () => {
  const s = base();
  const chip = s.chips.C[0].id;
  expect(studentStatus(s, "S01", "C", {})).toBe("none");
  s.inputs.S01 = { chipsC: { [chip]: "2026-11-17" } };
  expect(studentStatus(s, "S01", "C", {})).toBe("input");
  s.drafts.S01 = { C: { draft: "발표를 즐김.", reviewed: false } };
  expect(studentStatus(s, "S01", "C", {})).toBe("draft");
  s.drafts.S01.C.draft = "[보충 필요: 관찰 기록 없음]";
  expect(studentStatus(s, "S01", "C", {})).toBe("need");
  s.drafts.S01.C = { draft: "발표를 즐김.", reviewed: true };
  expect(studentStatus(s, "S01", "C", {})).toBe("reviewed");
});

test("진행률: 교과는 학생×교과, 창체는 학생×행사가 있는 영역", () => {
  const s = base();
  s.evalPlan = plan;
  s.activities = [{ id: "a", area: "진로활동", name: "직업 탐색", desc: "" }];
  expect(unitsOf(s, "A")).toEqual([{ subject: "국어" }, { subject: "수학" }]);
  expect(unitsOf(s, "B")).toEqual([{ area: "진로활동" }]);
  s.drafts = { S01: { "A:국어": { draft: "가", reviewed: true }, "A:수학": { draft: "나" } } };
  expect(sectionProgress(s, "A")).toEqual({ total: 4, drafted: 2, reviewed: 1 });
  expect(sectionProgress(s, "C")).toEqual({ total: 2, drafted: 0, reviewed: 0 });
});
