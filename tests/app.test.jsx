import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("../src/lib/provider.js", async (orig) => {
  const real = await orig();
  return { ...real, runBatch: vi.fn() };
});

import { runBatch } from "../src/lib/provider.js";
import App from "../src/App.jsx";
import { emptyState } from "../src/lib/defaults.js";
import { addStudents } from "../src/lib/students.js";
import { saveState } from "../src/lib/store.js";

beforeEach(() => {
  localStorage.clear();
  cleanup();
  window.confirm = () => true;
  const s = addStudents(emptyState(), ["가", "나"]);
  s.settings.geminiKey = "k";
  s.settings.guideText = "g";
  const id = s.chips.C[0].id;
  s.inputs = { S01: { chipsC: { [id]: "2026-11-17" } }, S02: { chipsC: { [id]: "2026-11-17" } } };
  saveState(s);
});

test("반 전체 생성 중 다른 탭에 갔다 와도 멈춤 버튼이 남고, 두 번째 생성이 시작되지 않는다", () => {
  runBatch.mockImplementation(() => new Promise(() => {}));
  render(<App />);
  const nav = (name) => fireEvent.click(screen.getAllByRole("button", { name }).find((b) => b.closest("nav")));
  nav("초안 만들기");
  fireEvent.click(screen.getByRole("button", { name: "반 전체 생성" }));
  nav("결과 검토");
  nav("초안 만들기");
  expect(screen.getByRole("button", { name: "멈춤" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "반 전체 생성" })).toBeNull();
  expect(runBatch).toHaveBeenCalledTimes(1);
});
