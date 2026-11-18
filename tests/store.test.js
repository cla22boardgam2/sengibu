import { emptyState, DEFAULT_CHIPS_C, DEFAULT_CHIPS_B, CHIP_GROUPS } from "../src/lib/defaults.js";
import { loadState, saveState, exportBackup, importBackup, STORAGE_KEY } from "../src/lib/store.js";

beforeEach(() => localStorage.clear());

test("빈 저장소면 빈 상태", () => {
  expect(loadState()).toEqual(emptyState());
});

test("저장한 것을 다시 읽는다", () => {
  const s = emptyState();
  s.settings.grade = 6;
  saveState(s);
  expect(loadState().settings.grade).toBe(6);
  expect(STORAGE_KEY).toBe("sengibu:v1");
});

test("깨진 JSON이면 빈 상태로 시작하고 원본을 보관", () => {
  localStorage.setItem("sengibu:v1", "{깨짐");
  expect(loadState()).toEqual(emptyState());
  expect(localStorage.getItem("sengibu:v1:broken")).toBe("{깨짐");
});

test("예전 구조에 없는 칸은 기본값으로 채운다", () => {
  localStorage.setItem("sengibu:v1", JSON.stringify({ students: [], settings: { grade: 3 } }));
  const s = loadState();
  expect(s.settings.byteLimits.C).toBe(1500);
  expect(s.settings.grade).toBe(3);
  expect(s.chips.C.length).toBeGreaterThan(0);
});

test("백업 왕복", () => {
  const s = emptyState();
  s.settings.classNote = "x";
  expect(importBackup(exportBackup(s))).toEqual(s);
});

test("잘못된 백업은 오류", () => {
  expect(() => importBackup("[]")).toThrow("백업 파일을 읽을 수 없어요");
  expect(() => importBackup("{깨짐")).toThrow("백업 파일을 읽을 수 없어요");
  expect(() => importBackup('{"hello":1}')).toThrow("백업 파일을 읽을 수 없어요");
});

test("백업에 API 키는 넣지 않고, 불러와도 지금 키를 지우지 않는다", () => {
  const s = emptyState();
  s.settings.geminiKey = "secret-key-123";
  const json = exportBackup(s);
  expect(json).not.toContain("secret-key-123");
  expect(importBackup(json, "kept").settings.geminiKey).toBe("kept");
});

test("기본 행발 칩은 문구가 겹치지 않고 노력할 점은 negative", () => {
  const texts = DEFAULT_CHIPS_C.map((c) => c.text);
  expect(new Set(texts).size).toBe(texts.length);
  expect(DEFAULT_CHIPS_C.filter((c) => c.group === "노력할 점").every((c) => c.negative)).toBe(true);
  expect(new Set(DEFAULT_CHIPS_B.map((c) => c.text)).size).toBe(DEFAULT_CHIPS_B.length);
});

describe("행발 칩 두 단계", () => {
  test("기본 칩: 큰 분류 6개, 분류마다 소분류 3개 이상, 문구는 구체적인 문장", () => {
    expect(CHIP_GROUPS).toEqual(["학습", "인성", "관계", "생활", "재능", "노력할 점"]);
    expect(DEFAULT_CHIPS_C.length).toBeGreaterThanOrEqual(80);
    for (const g of CHIP_GROUPS) {
      const subs = new Set(DEFAULT_CHIPS_C.filter((c) => c.group === g).map((c) => c.sub));
      expect(subs.size).toBeGreaterThanOrEqual(3);
    }
    expect(DEFAULT_CHIPS_C.every((c) => c.sub && CHIP_GROUPS.includes(c.group))).toBe(true);
    expect(DEFAULT_CHIPS_C.every((c) => c.text.length >= 6)).toBe(true);
    expect(DEFAULT_CHIPS_C.some((c) => c.text === "손을 들어 자기 생각을 자주 발표함" && c.group === "학습")).toBe(true);
  });

  test("예전 칩 목록을 불러오면: 새 목록으로 바꾸되, 학생이 고른 칩과 직접 넣은 칩은 '이전 칩'으로 남긴다", () => {
    const old = [
      { id: "c-0-0", group: "성품", text: "예의 바름", negative: false },
      { id: "c-1-2", group: "학습", text: "발표 잘함", negative: false },
      { id: "c-5-0", group: "노력할 점", text: "집중 시간 짧음", negative: true },
      { id: "c-abc1234", group: "친구", text: "우리 반 분위기 메이커", negative: false },
    ];
    localStorage.setItem("sengibu:v1", JSON.stringify({
      chips: { C: old, B: [] },
      inputs: { S01: { chipsC: { "c-1-2": "2026-11-17" } }, S02: { chipsC: { "c-5-0": "2026-11-10" } } },
    }));
    const C = loadState().chips.C;
    expect(C.find((c) => c.id === "c-0-0")).toBeUndefined();
    expect(C.find((c) => c.id === "c-1-2")).toMatchObject({ group: "학습", sub: "이전 칩", text: "발표 잘함" });
    expect(C.find((c) => c.id === "c-5-0")).toMatchObject({ group: "노력할 점", sub: "이전 칩", negative: true });
    expect(C.find((c) => c.id === "c-abc1234")).toMatchObject({ group: "관계", sub: "이전 칩" });
    expect(C.filter((c) => c.sub !== "이전 칩").length).toBe(DEFAULT_CHIPS_C.length);
  });

  test("이미 새 구조인 칩 목록은 고친 그대로 둔다", () => {
    const mine = [{ id: "k-x", group: "학습", sub: "수업 태도", text: "내가 고친 칩", negative: false }];
    localStorage.setItem("sengibu:v1", JSON.stringify({ chips: { C: mine, B: [] } }));
    expect(loadState().chips.C).toEqual(mine);
  });
});
