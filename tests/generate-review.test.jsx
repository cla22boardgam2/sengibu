import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("../src/lib/provider.js", async (orig) => {
  const real = await orig();
  return { ...real, runBatch: vi.fn() };
});

import { runBatch } from "../src/lib/provider.js";
import { AppStateProvider } from "../src/state.jsx";
import Generate from "../src/screens/Generate.jsx";
import Review from "../src/screens/Review.jsx";
import { emptyState } from "../src/lib/defaults.js";
import { addStudents } from "../src/lib/students.js";
import { saveState, loadState } from "../src/lib/store.js";

function seed({ key = "", drafts = {} } = {}) {
  const s = addStudents(emptyState(), ["김지수", "박민", "이하늘"]);
  s.settings.guideText = "기재요령";
  s.settings.geminiKey = key;
  const id = s.chips.C.find((c) => c.text === "발표 잘함").id;
  for (const p of ["S01", "S02", "S03"]) s.inputs[p] = { chipsC: { [id]: "2026-11-17" } };
  s.drafts = drafts;
  saveState(s);
}

let copied = [];
beforeEach(() => {
  localStorage.clear();
  cleanup();
  copied = [];
  Object.assign(navigator, { clipboard: { writeText: async (t) => { copied.push(t); } } });
  window.confirm = () => true;
  runBatch.mockReset();
});
const wrap = (ui) => render(<AppStateProvider>{ui}</AppStateProvider>);
const pickSection = (name) => fireEvent.click(screen.getByRole("tab", { name }));

test("키 없이: 프롬프트 복사 → 답 붙여넣기 → 저장되면 다음 학생으로", async () => {
  seed();
  wrap(<Generate />);
  pickSection("행발");
  expect(screen.getByRole("heading", { name: "1번 김지수" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "프롬프트 복사" }));
  await waitFor(() => expect(copied).toHaveLength(1));
  expect(copied[0]).toContain("[학생 ID] S01");
  expect(copied[0]).not.toContain("김지수");
  fireEvent.change(screen.getByLabelText("답 붙여넣기"), {
    target: { value: '{"student_id":"S01","section":"C","draft":"발표를 즐김.","evidence":[],"warnings":[],"missing":[]}' },
  });
  fireEvent.click(screen.getByRole("button", { name: "답 저장" }));
  expect(loadState().drafts.S01.C).toMatchObject({ draft: "발표를 즐김.", reviewed: false });
  expect(screen.getByRole("heading", { name: "2번 박민" })).toBeTruthy();
});

test("다른 학생 답이면 저장 전에 확인한다", () => {
  seed();
  let asked = "";
  window.confirm = (m) => { asked = m; return false; };
  wrap(<Generate />);
  pickSection("행발");
  fireEvent.change(screen.getByLabelText("답 붙여넣기"), { target: { value: '{"student_id":"S09","draft":"가"}' } });
  fireEvent.click(screen.getByRole("button", { name: "답 저장" }));
  expect(asked).toContain("S09");
  expect(loadState().drafts.S01).toBeUndefined();
});

test("키가 있으면 반 전체 생성: 진행률과 멈춤", async () => {
  seed({ key: "k" });
  let resolveRun;
  runBatch.mockImplementation(({ pseudoIds, onResult, onStatus, signal }) => {
    onResult(pseudoIds[0], { student_id: "S01", section: "C", draft: "가.", evidence: [], warnings: [], missing: [], idMismatch: false });
    onStatus("2 / 3 쓰는 중");
    return new Promise((r) => { resolveRun = () => r({ done: [pseudoIds[0]], pausedAt: signal.aborted ? pseudoIds[1] : null }); });
  });
  wrap(<Generate />);
  pickSection("행발");
  fireEvent.click(screen.getByRole("button", { name: "반 전체 생성" }));
  expect(await screen.findByText("2 / 3 쓰는 중")).toBeTruthy();
  expect(screen.getByText("1 / 3 완료")).toBeTruthy();
  expect(loadState().drafts.S01.C.draft).toBe("가.");
  const call = runBatch.mock.calls[0][0];
  expect(call.pseudoIds).toEqual(["S01", "S02", "S03"]);
  fireEvent.click(screen.getByRole("button", { name: "멈춤" }));
  expect(call.signal.aborted).toBe(true);
  resolveRun();
  expect(await screen.findByRole("button", { name: "이어서 하기" })).toBeTruthy();
});

const reviewSeed = (draft) => seed({ drafts: { S01: { C: { draft, evidence: [{ sentence: "가", source: "칩: 발표 잘함" }], warnings: ["근거 약함"], missing: [], reviewed: false } } } });

test("검토: 체크해야 복사가 켜지고, 고치면 다시 꺼진다", () => {
  reviewSeed("발표를 즐김.");
  wrap(<Review />);
  pickSection("행발");
  const c = screen.getByRole("region", { name: "1번 학생 초안" });
  const copy = within(c).getByRole("button", { name: "복사" });
  expect(copy.disabled).toBe(true);
  fireEvent.click(within(c).getByLabelText("검토 완료"));
  expect(copy.disabled).toBe(false);
  expect(loadState().drafts.S01.C.reviewed).toBe(true);
  fireEvent.change(within(c).getByLabelText("초안"), { target: { value: "발표를 즐겨 함." } });
  expect(copy.disabled).toBe(true);
  expect(within(c).getByText("근거 약함")).toBeTruthy();
});

test("검토: 화면에서는 가명을 실명으로, 저장은 가명으로", () => {
  reviewSeed("S02와 협력함.");
  wrap(<Review />);
  pickSection("행발");
  const box = screen.getByLabelText("초안");
  expect(box.value).toBe("박민와 협력함.");
  fireEvent.change(box, { target: { value: "박민와 잘 협력함." } });
  expect(loadState().drafts.S01.C.draft).toBe("S02와 잘 협력함.");
  expect(screen.getByText(/초안에 학생 이름이나 ID가 들어 있어요/)).toBeTruthy();
});

test("검토: [보충 필요] 빨간 강조와 바이트 초과 표시", () => {
  reviewSeed("[보충 필요: 학기 초 기록] 가" + "나".repeat(600));
  wrap(<Review />);
  pickSection("행발");
  expect(screen.getByTestId("need-more").textContent).toContain("보충 필요");
  const counter = screen.getByTestId("byte-counter");
  expect(counter.textContent).toMatch(/\/ 1500/);
  expect(counter.className).toContain("text-red");
});

test("검토: 강조 표시는 다시 그려도 계속 보인다", () => {
  reviewSeed("[보충 필요: 기록] 가");
  wrap(<Review />);
  pickSection("행발");
  fireEvent.click(screen.getByLabelText("검토 완료"));
  fireEvent.click(screen.getByLabelText("검토 완료"));
  expect(screen.getAllByTestId("need-more")).toHaveLength(1);
});
