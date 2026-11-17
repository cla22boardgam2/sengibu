import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { AppStateProvider } from "../src/state.jsx";
import Inputs from "../src/screens/Inputs.jsx";
import { emptyState } from "../src/lib/defaults.js";
import { addStudents } from "../src/lib/students.js";
import { saveState, loadState } from "../src/lib/store.js";
import { todayStr } from "../src/lib/date.js";

function seed() {
  const s = addStudents(emptyState(), ["김지수", "박민"]);
  s.evalPlan = [
    { id: "국어|1|토론", subject: "국어", area: "말하기", code: "1", element: "토론", levels: { vg: "A", g: "B", n: "C", e: "D" } },
    { id: "국어|2|요약", subject: "국어", area: "읽기", code: "2", element: "요약", levels: { vg: "", g: "B", n: "C", e: "D" } },
  ];
  saveState(s);
}

beforeEach(() => { localStorage.clear(); cleanup(); seed(); window.confirm = () => true; });
const open = (tab) => {
  render(<AppStateProvider><Inputs /></AppStateProvider>);
  fireEvent.click(screen.getByRole("tab", { name: tab }));
};
const card = (n) => screen.getByRole("region", { name: `${n}번 학생` });

test("행발 칩을 누르면 오늘 날짜로 저장되고, 다시 누르면 빠진다", () => {
  open("행발");
  const btn = within(card(1)).getByRole("button", { name: "발표 잘함" });
  fireEvent.click(btn);
  const id = loadState().chips.C.find((c) => c.text === "발표 잘함").id;
  expect(loadState().inputs.S01.chipsC[id]).toBe(todayStr());
  expect(btn.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(btn);
  expect(loadState().inputs.S01.chipsC[id]).toBeUndefined();
});

test("재료가 같은 학생을 알려 주고, 메모를 더하면 알림이 사라진다", () => {
  open("행발");
  fireEvent.click(within(card(1)).getByRole("button", { name: "발표 잘함" }));
  fireEvent.click(within(card(2)).getByRole("button", { name: "발표 잘함" }));
  expect(screen.getByText(/1번과 2번의 재료가 같아요/)).toBeTruthy();
  fireEvent.change(within(card(2)).getByLabelText("메모 내용"), { target: { value: "실험을 다시 해 봄" } });
  fireEvent.click(within(card(2)).getByRole("button", { name: "메모 추가" }));
  expect(screen.queryByText(/재료가 같아요/)).toBeNull();
  expect(loadState().inputs.S02.memos.C[0].text).toBe("실험을 다시 해 봄");
});

test("교과: 3단계 행은 버튼 3개, 4단계 행은 4개", () => {
  open("교과");
  const c = card(1);
  expect(within(within(c).getByRole("group", { name: "토론" })).getAllByRole("button")).toHaveLength(4);
  expect(within(within(c).getByRole("group", { name: "요약" })).getAllByRole("button")).toHaveLength(3);
});

test("교과: 반 전체 같은 등급", () => {
  open("교과");
  const bulk = screen.getByRole("group", { name: "반 전체 · 토론" });
  fireEvent.click(within(bulk).getByRole("button", { name: "잘함" }));
  const st = loadState();
  expect(st.inputs.S01.grades["국어|1|토론"].level).toBe("g");
  expect(st.inputs.S02.grades["국어|1|토론"].level).toBe("g");
});

test("평가계획이 없으면 설정 안내", () => {
  localStorage.clear();
  saveState(addStudents(emptyState(), ["가"]));
  open("교과");
  expect(screen.getByText(/설정에서 평가계획을 먼저 넣어 주세요/)).toBeTruthy();
});
