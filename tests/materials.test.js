import { emptyState } from "../src/lib/defaults.js";
import { addStudents } from "../src/lib/students.js";
import { buildRequest, draftKeyOf, findSameMaterial } from "../src/lib/materials.js";

function base() {
  let s = addStudents(emptyState(), ["김지수", "박민", "이하늘"]);
  s.settings.guideText = "기재요령 발췌";
  s.evalPlan = [
    { id: "국어|6국01-03|토론하기", subject: "국어", area: "듣기·말하기", code: "6국01-03", element: "토론하기",
      levels: { vg: "근거를 들어 논리적으로 토론함", g: "근거를 들어 토론함", n: "토론에 참여함", e: "도움을 받아 토론함" } },
    { id: "수학|6수01-01|나눗셈", subject: "수학", area: "수와 연산", code: "6수01-01", element: "나눗셈",
      levels: { vg: "", g: "능숙함", n: "할 수 있음", e: "도움 필요" } },
  ];
  s.activities = [
    { id: "a1", area: "동아리활동", name: "과학탐구반", desc: "생활 속 과학 실험" },
    { id: "a2", area: "진로활동", name: "직업 체험의 날", desc: "직업인 인터뷰" },
  ];
  return s;
}

const chip = (s, text) => s.chips.C.find((c) => c.text === text).id;

test("draftKeyOf", () => {
  expect(draftKeyOf("A", { subject: "국어" })).toBe("A:국어");
  expect(draftKeyOf("B", { area: "동아리활동" })).toBe("B:동아리활동");
  expect(draftKeyOf("C", {})).toBe("C");
  expect(draftKeyOf("D", {})).toBe("D");
});

test("C: 칩은 날짜 있는 관찰 기록이 되고, 실명은 요청에 들어가지 않는다", () => {
  const s = base();
  s.inputs.S01 = {
    chipsC: { [chip(s, "발표 잘함")]: "2026-11-17" },
    memos: { C: [{ id: "m1", date: "2026-05-12", text: "박민이 다쳤을 때 김지수가 보건실에 데려감" }, { id: "m2", date: "", text: "발표 자신감이 늘어난 점 강조" }] },
  };
  const r = buildRequest(s, "S01", "C", {});
  expect(r.student.pseudoId).toBe("S01");
  expect(r.student.grade).toBe(5);
  expect(r.student.logs).toEqual([
    { date: "2026-05-12", text: "S02이 다쳤을 때 S01가 보건실에 데려감" },
    { date: "2026-11-17", text: "칩: 발표 잘함" },
  ]);
  expect(r.student.memo).toContain("발표 자신감이 늘어난 점 강조");
  expect(r.student.memo).toContain("분량: 보통");
  expect(r.scrubbed).toBe(2);
  expect(r.empty).toBe(false);
  expect(r.guideText).toBe("기재요령 발췌");
  expect(JSON.stringify(r)).not.toMatch(/김지수|박민/);
});

test("반 전체 추가 지시는 memo 끝에 붙는다", () => {
  const s = base();
  s.settings.classNote = "~임 위주로";
  s.settings.length = "short";
  s.inputs.S01 = { chipsC: { [chip(s, "집중 잘함")]: "2026-11-17" } };
  const memo = buildRequest(s, "S01", "C", {}).student.memo;
  expect(memo).toBe("분량: 짧게\n~임 위주로");
});

test("A: 고른 등급의 기준 문장이 기록이 되고, 교과 평가기준이 extraDocs에 들어간다", () => {
  const s = base();
  s.inputs.S01 = { grades: { "국어|6국01-03|토론하기": { level: "vg", date: "2026-07-01" } } };
  const r = buildRequest(s, "S01", "A", { subject: "국어" });
  expect(r.opts).toEqual({ subject: "국어", grade: 5 });
  expect(r.student.logs).toEqual([
    { date: "2026-07-01", text: "평가: 토론하기 (6국01-03) — 매우잘함: 근거를 들어 논리적으로 토론함" },
  ]);
  expect(r.extraDocs).toContain("6국01-03");
  expect(r.extraDocs).not.toContain("6수01-01");
});

test("B: 참여한 행사와 역할 칩이 기록이 되고, 행사 목록이 extraDocs에 들어간다", () => {
  const s = base();
  s.inputs.S01 = { acts: { a1: { joined: true, roles: { "b-1": "2026-10-14", "b-4": "2026-10-20" } } } };
  const r = buildRequest(s, "S01", "B", { area: "동아리활동" });
  expect(r.student.logs).toEqual([{ date: "2026-10-14", text: "참여: 과학탐구반 — 역할: 기록 담당, 발표" }]);
  expect(r.extraDocs).toContain("[학교 교육활동 목록]");
  expect(r.extraDocs).toContain("직업 체험의 날");
});

test("B: 입력이 없으면 참여(기본값)로 보고 역할은 '기록 없음'", () => {
  const s = base();
  const r = buildRequest(s, "S02", "B", { area: "동아리활동" });
  expect(r.student.logs).toEqual([{ date: "", text: "참여: 과학탐구반 — 역할: 기록 없음" }]);
});

test("B: 참여를 뺀 행사는 들어가지 않는다", () => {
  const s = base();
  s.inputs.S01 = { acts: { a1: { joined: false, roles: {} } } };
  expect(buildRequest(s, "S01", "B", { area: "동아리활동" }).empty).toBe(true);
});

test("D: 행발 칩과 교과 등급을 함께 쓰고, 지침이 있으면 extraDocs에 넣는다", () => {
  const s = base();
  s.settings.hasSchoolGuide = true;
  s.settings.reportGuideText = "학부모 대상, 300자";
  s.inputs.S01 = {
    chipsC: { [chip(s, "발표 잘함")]: "2026-11-17" },
    grades: { "수학|6수01-01|나눗셈": { level: "g", date: "2026-07-01" } },
  };
  const r = buildRequest(s, "S01", "D", {});
  expect(r.opts).toEqual({ maxChars: 300, hasSchoolGuide: true });
  expect(r.student.logs.map((l) => l.text)).toEqual(["수학 평가: 나눗셈 (6수01-01) — 잘함: 능숙함", "칩: 발표 잘함"]);
  expect(r.extraDocs).toContain("학부모 대상, 300자");
});

test("usedOpenings는 같은 항목 다른 학생 초안의 첫 어절, otherDrafts는 이 학생의 다른 항목", () => {
  const s = base();
  s.inputs.S01 = { chipsC: { [chip(s, "발표 잘함")]: "2026-11-17" } };
  s.drafts = {
    S01: { C: { draft: "내 행발" }, "A:국어": { draft: "국어 초안" }, "A:수학": { draft: "[보충 필요: 수학]" }, "B:진로활동": { draft: "진로 초안" } },
    S02: { C: { draft: "수업 시간에 적극적" } },
    S03: { C: { draft: "수업 태도가 좋음" }, "A:국어": { draft: "다른 항목" } },
  };
  const r = buildRequest(s, "S01", "C", {});
  expect(r.student.usedOpenings).toEqual(["수업"]);
  expect(r.student.otherDrafts).toEqual({ A: "국어 초안", B: "진로 초안" });
});

test("재료가 없으면 empty", () => {
  expect(buildRequest(base(), "S01", "C", {}).empty).toBe(true);
});

test("기록은 날짜순, 날짜 없는 것은 뒤로", () => {
  const s = base();
  s.inputs.S01 = { memos: { C: [{ id: "1", date: "2026-09-01", text: "나중" }, { id: "2", date: "2026-03-02", text: "먼저" }] } };
  expect(buildRequest(s, "S01", "C", {}).student.logs.map((l) => l.text)).toEqual(["먼저", "나중"]);
});

test("findSameMaterial: 칩이 같은 학생을 묶고, 메모를 더하면 풀린다", () => {
  const s = base();
  const id = chip(s, "발표 잘함");
  s.inputs.S01 = { chipsC: { [id]: "2026-11-17" } };
  s.inputs.S03 = { chipsC: { [id]: "2026-11-10" } };
  expect(findSameMaterial(s, "C", {})).toEqual([["S01", "S03"]]);
  s.inputs.S03.memos = { C: [{ id: "m", date: "", text: "실험을 다시 해 봄" }] };
  expect(findSameMaterial(s, "C", {})).toEqual([]);
});

test("날짜 없는 메모만 있으면 그 메모를 관찰 기록으로 쓴다", () => {
  const s = base();
  s.inputs.S01 = { memos: { C: [{ id: "1", date: "", text: "실험 결과를 꼼꼼히 기록함" }] } };
  const r = buildRequest(s, "S01", "C", {});
  expect(r.empty).toBe(false);
  expect(r.student.logs).toEqual([{ date: "", text: "실험 결과를 꼼꼼히 기록함" }]);
  expect(r.student.memo).toBe("분량: 보통");
});
