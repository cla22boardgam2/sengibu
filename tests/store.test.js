import { emptyState, DEFAULT_CHIPS_C, DEFAULT_CHIPS_B } from "../src/lib/defaults.js";
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
