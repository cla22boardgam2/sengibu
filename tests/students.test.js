import { emptyState } from "../src/lib/defaults.js";
import { addStudents, removeStudent, scrubNames, toRealNames, firstWord } from "../src/lib/students.js";

test("빈 줄을 빼고 가명을 순서대로 붙인다", () => {
  const s = addStudents(emptyState(), ["김지수", " ", "  박민 "]);
  expect(s.students).toEqual([
    { pseudoId: "S01", number: 1, name: "김지수" },
    { pseudoId: "S02", number: 2, name: "박민" },
  ]);
});

test("삭제 후 추가해도 가명 번호를 재사용하지 않는다", () => {
  let s = addStudents(emptyState(), ["가", "나"]);
  s = removeStudent(s, "S02");
  s = addStudents(s, ["다"]);
  expect(s.students.map((x) => x.pseudoId)).toEqual(["S01", "S03"]);
  expect(s.students.map((x) => x.number)).toEqual([1, 2]);
});

test("100번째 학생부터는 세 자리", () => {
  const s = addStudents(emptyState(), Array.from({ length: 100 }, (_, i) => `학생${i}`));
  expect(s.students[99].pseudoId).toBe("S100");
});

test("학생을 지우면 그 학생 입력과 초안도 지운다", () => {
  let s = addStudents(emptyState(), ["가"]);
  s.inputs.S01 = { chipsC: { x: "2026-11-17" } };
  s.drafts.S01 = { C: { draft: "가" } };
  s = removeStudent(s, "S01");
  expect(s.inputs.S01).toBeUndefined();
  expect(s.drafts.S01).toBeUndefined();
});

test("실명은 긴 이름부터 가명으로 바꾸고 횟수를 센다", () => {
  const st = [{ pseudoId: "S01", name: "지수" }, { pseudoId: "S02", name: "김지수" }];
  expect(scrubNames("김지수와 지수가 다툼", st)).toEqual({ text: "S02와 S01가 다툼", count: 2 });
  expect(scrubNames("", st)).toEqual({ text: "", count: 0 });
});

test("화면 표시용으로 가명을 실명으로 바꾼다 (S1이 S10을 건드리지 않음)", () => {
  const st = [{ pseudoId: "S01", name: "가" }, { pseudoId: "S10", name: "나" }];
  expect(toRealNames("S10 학생과 S01 학생", st)).toBe("나 학생과 가 학생");
});

test("첫 어절", () => {
  expect(firstWord("  토론의 절차와 규칙을")).toBe("토론의");
  expect(firstWord("[보충 필요: 관찰 기록 없음]")).toBe("");
  expect(firstWord("")).toBe("");
});
