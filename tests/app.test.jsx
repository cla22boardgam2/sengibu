import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
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
  nav("작업");
  fireEvent.click(screen.getByRole("button", { name: /입력된 학생 전체 생성/ }));
  nav("홈");
  nav("작업");
  expect(screen.getByRole("button", { name: "멈춤" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /입력된 학생 전체 생성/ })).toBeNull();
  expect(runBatch).toHaveBeenCalledTimes(1);
});

test("메뉴는 홈·학생·작업·백업·설정 글자 탭이고, 앱은 홈에서 시작한다", () => {
  render(<App />);
  const nav = screen.getByRole("navigation");
  expect([...nav.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["홈", "학생", "작업", "백업", "설정"]);
  expect(screen.getByText("시작 준비").closest("[hidden]")).toBeNull();
});

test("홈 체크리스트에서 하러 가기를 누르면 설정의 그 묶음이 펼쳐진다", () => {
  render(<App />);
  expect(screen.getByRole("button", { name: "학생 명단 보기" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "바이트 상한 하러 가기" }));
  const head = screen.getByRole("button", { name: /글자 수 상한/ });
  expect(head.getAttribute("aria-expanded")).toBe("true");
  expect(head.closest("[hidden]")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "홈" }));
  fireEvent.click(screen.getByRole("button", { name: "평가계획 하러 가기" }));
  expect(screen.getByRole("button", { name: /^평가계획 ?교과/ }).getAttribute("aria-expanded")).toBe("true");
});

test("홈 항목 카드: 빠진 것과 진행률을 보이고, 작업하기로 그 항목을 연다", () => {
  render(<App />);
  const card = screen.getByRole("region", { name: "창체 카드" });
  expect(within(card).getByText("빠짐: 행사 목록")).toBeTruthy();
  const hb = screen.getByRole("region", { name: "행발 카드" });
  expect(within(hb).getByText("준비 완료")).toBeTruthy();
  expect(within(hb).getAllByText("0 / 2")).toHaveLength(2);
  fireEvent.click(within(screen.getByRole("region", { name: "교과 평어 카드" })).getByRole("button", { name: "교과 평어 작업하기" }));
  expect(screen.getByRole("tab", { name: "교과 평어" }).getAttribute("aria-selected")).toBe("true");
});

test("처음 연 사람: 홈 체크리스트만 보고 학생을 넣고 행발 첫 초안(복사 방식)까지 간다", async () => {
  localStorage.clear();
  const copied = [];
  Object.assign(navigator, { clipboard: { writeText: async (t) => { copied.push(t); } } });
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "학생 명단 하러 가기" }));
  fireEvent.change(screen.getByLabelText("학생 이름 붙여넣기"), { target: { value: "김지수\n박민" } });
  fireEvent.click(screen.getByRole("button", { name: "학생 추가" }));
  fireEvent.click(screen.getByRole("button", { name: "홈" }));
  fireEvent.click(screen.getByRole("button", { name: "기재요령 발췌 하러 가기" }));
  fireEvent.change(screen.getByLabelText("기재요령 발췌"), { target: { value: "요령" } });
  fireEvent.click(screen.getByRole("button", { name: "홈" }));
  fireEvent.click(screen.getByRole("button", { name: "행발 작업하기" }));
  fireEvent.click(screen.getByRole("button", { name: /^학습/ }));
  fireEvent.click(screen.getByRole("button", { name: "발표 잘함" }));
  fireEvent.click(screen.getByRole("button", { name: "프롬프트 복사" }));
  await waitFor(() => expect(copied).toHaveLength(1));
  fireEvent.change(screen.getByLabelText("답 붙여넣기"), { target: { value: '{"student_id":"S01","draft":"발표를 즐김."}' } });
  fireEvent.click(screen.getByRole("button", { name: "답 저장" }));
  expect(screen.getByLabelText("초안").value).toBe("발표를 즐김.");
});
