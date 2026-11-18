import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AppStateProvider } from "../src/state.jsx";
import Students from "../src/screens/Students.jsx";
import Settings from "../src/screens/Settings.jsx";
import Backup from "../src/screens/Backup.jsx";
import { loadState } from "../src/lib/store.js";
import { DEFAULT_CHIPS_C } from "../src/lib/defaults.js";

beforeEach(() => { localStorage.clear(); cleanup(); });
const wrap = (ui) => render(<AppStateProvider>{ui}</AppStateProvider>);

test("학생 이름을 여러 줄 붙여넣으면 가명이 붙고 저장된다", () => {
  wrap(<Students />);
  fireEvent.change(screen.getByLabelText("학생 이름 붙여넣기"), { target: { value: "김지수\n박민\n" } });
  fireEvent.click(screen.getByRole("button", { name: "학생 추가" }));
  expect(screen.getByText("S01")).toBeTruthy();
  expect(screen.getByText("S02")).toBeTruthy();
  expect(loadState().students.map((s) => s.name)).toEqual(["김지수", "박민"]);
});

test("평가계획을 붙여넣으면 읽은 결과를 알려 준다", () => {
  wrap(<Settings />);
  fireEvent.click(screen.getByRole("button", { name: /^평가계획/ }));
  const tsv = [
    "교과\t영역(단원)\t성취기준 코드\t평가요소\t매우잘함\t잘함\t보통\t노력요함",
    "국어\t듣기·말하기\t6국01-03\t토론하기\tA\tB\tC\tD",
    "\t\t6국02-02\t요약하기\t\tB2\tC2\tD2",
    "수학\t수와 연산\t6수01-01\t\tA\tB\tC\tD",
  ].join("\n");
  fireEvent.change(screen.getByLabelText("평가계획 붙여넣기"), { target: { value: tsv } });
  fireEvent.click(screen.getByRole("button", { name: "평가계획 읽기" }));
  expect(screen.getByText(/국어 2개/)).toBeTruthy();
  expect(screen.getByText(/1줄 건너뜀/)).toBeTruthy();
  expect(loadState().evalPlan).toHaveLength(2);
});

test("설정 화면에 무료 등급 안내가 늘 보인다", () => {
  wrap(<Settings />);
  expect(screen.getByText(/무료 등급은 보낸 내용이 서비스 개선에 쓰일 수 있어요/)).toBeTruthy();
});

test("바이트 상한이 비면 미확인 안내", () => {
  wrap(<Settings />);
  expect(screen.getAllByText(/미확인 — 기재요령에서 확인 후 입력/).length).toBe(2);
});

test("잘못된 백업 파일을 불러오면 오류를 보이고 자료는 그대로", async () => {
  wrap(<><Students /><Backup /></>);
  fireEvent.change(screen.getByLabelText("학생 이름 붙여넣기"), { target: { value: "김지수" } });
  fireEvent.click(screen.getByRole("button", { name: "학생 추가" }));
  const file = new File(["[]"], "x.json", { type: "application/json" });
  fireEvent.change(screen.getByLabelText("백업 파일 불러오기"), { target: { files: [file] } });
  expect(await screen.findByText("백업 파일을 읽을 수 없어요")).toBeTruthy();
  expect(loadState().students).toHaveLength(1);
});

test("설정 고급: 행발 칩은 작업 화면에서 고친다고 안내하고, 기본 목록으로 되돌릴 수 있다", () => {
  const s = loadState();
  s.chips.C = [{ id: "k-x", group: "학습", sub: "수업 태도", text: "내가 만든 칩", negative: false }];
  localStorage.setItem("sengibu:v1", JSON.stringify(s));
  window.confirm = () => true;
  wrap(<Settings />);
  fireEvent.click(screen.getByRole("button", { name: /^고급/ }));
  expect(screen.getByText(/행발 칩은 작업 화면의 \[칩 편집\]에서/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "행발 칩 기본 목록으로 되돌리기" }));
  expect(loadState().chips.C).toEqual(DEFAULT_CHIPS_C);
});
