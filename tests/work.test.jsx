import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("../src/lib/provider.js", async (orig) => {
  const real = await orig();
  return { ...real, runBatch: vi.fn() };
});

import { runBatch } from "../src/lib/provider.js";
import { AppStateProvider } from "../src/state.jsx";
import Work from "../src/screens/Work.jsx";
import { emptyState } from "../src/lib/defaults.js";
import { addStudents } from "../src/lib/students.js";
import { saveState, loadState } from "../src/lib/store.js";
import { todayStr } from "../src/lib/date.js";

const PLAN = [
  { id: "국어|1|토론", subject: "국어", area: "말하기", code: "1", element: "토론", levels: { vg: "A", g: "B", n: "C", e: "D" } },
  { id: "국어|2|요약", subject: "국어", area: "읽기", code: "2", element: "요약", levels: { vg: "", g: "B", n: "C", e: "D" } },
];

function seed({ names = ["김지수", "박민", "이하늘"], key = "", chips = false, drafts = {}, plan = PLAN } = {}) {
  const s = addStudents(emptyState(), names);
  s.settings.guideText = "기재요령";
  s.settings.geminiKey = key;
  s.evalPlan = plan;
  if (chips) {
    const id = s.chips.C.find((c) => c.text === "발표 잘함").id;
    for (const st of s.students) s.inputs[st.pseudoId] = { chipsC: { [id]: "2026-11-17" } };
  }
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

const open = (sectionName, props = {}) => {
  render(<AppStateProvider><Work active {...props} /></AppStateProvider>);
  if (sectionName) fireEvent.click(screen.getByRole("tab", { name: sectionName }));
};
const pick = (n, name) => fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${n}번 ${name}`) }));
const input = () => screen.getByRole("region", { name: /번 학생$/ });
const draftBox = () => screen.getByRole("region", { name: /번 학생 초안$/ });
const openGroup = (g) => fireEvent.click(within(input()).getByRole("button", { name: new RegExp(`^${g}`) }));

describe("한 번에 한 학생", () => {
  test("왼쪽 목록에서 고른 학생 한 명만 가운데에 보이고, 다음·이전·키보드로 넘긴다", () => {
    seed();
    open("행발");
    expect(screen.getByRole("heading", { name: "1번 김지수" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "2번 박민" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다음 학생 →" }));
    expect(screen.getByRole("heading", { name: "2번 박민" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("heading", { name: "3번 이하늘" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByRole("heading", { name: "2번 박민" })).toBeTruthy();
    pick(1, "김지수");
    expect(screen.getByRole("heading", { name: "1번 김지수" })).toBeTruthy();
  });

  test("글을 쓰는 중에는 ← → 가 학생을 넘기지 않는다", () => {
    seed();
    open("행발");
    fireEvent.keyDown(within(input()).getByLabelText("메모 내용"), { key: "ArrowRight" });
    expect(screen.getByRole("heading", { name: "1번 김지수" })).toBeTruthy();
  });

  test("학생 목록에 상태가 보인다: 입력 없음 → 입력됨", () => {
    seed();
    open("행발");
    expect(screen.getByRole("button", { name: "1번 김지수 · 입력 없음" })).toBeTruthy();
    openGroup("학습");
    fireEvent.click(within(input()).getByRole("button", { name: "발표 잘함" }));
    expect(screen.getByRole("button", { name: "1번 김지수 · 입력됨" })).toBeTruthy();
  });
});

describe("입력", () => {
  test("행발 칩: 분류를 펼쳐 고르면 오늘 날짜로 저장되고 위 요약에 보이며, 요약에서 빼면 빠진다", () => {
    seed();
    open("행발");
    expect(within(input()).queryByRole("button", { name: "발표 잘함" })).toBeNull();
    openGroup("학습");
    fireEvent.click(within(input()).getByRole("button", { name: "발표 잘함" }));
    const id = loadState().chips.C.find((c) => c.text === "발표 잘함").id;
    expect(loadState().inputs.S01.chipsC[id]).toBe(todayStr());
    fireEvent.click(within(input()).getByRole("button", { name: "발표 잘함 빼기" }));
    expect(loadState().inputs.S01.chipsC[id]).toBeUndefined();
  });

  test("펼친 분류는 다음 학생으로 넘어가도 펼쳐져 있다", () => {
    seed();
    open("행발");
    openGroup("학습");
    fireEvent.click(screen.getByRole("button", { name: "다음 학생 →" }));
    expect(within(input()).getByRole("button", { name: "발표 잘함" })).toBeTruthy();
  });

  test("재료가 같은 학생을 알려 주고, 메모를 더하면 알림이 사라진다", () => {
    seed({ chips: true });
    open("행발");
    expect(screen.getByText(/1번, 2번, 3번의 재료가 같아요/)).toBeTruthy();
    fireEvent.change(within(input()).getByLabelText("메모 내용"), { target: { value: "실험을 다시 해 봄" } });
    fireEvent.click(within(input()).getByRole("button", { name: "메모 추가" }));
    expect(screen.queryByText(/1번.*재료가 같아요/)).toBeNull();
    expect(loadState().inputs.S01.memos.C[0].text).toBe("실험을 다시 해 봄");
  });

  test("교과: 3단계 행은 버튼 3개, 4단계 행은 4개, 반 전체 등급", () => {
    seed();
    open("교과 평어");
    expect(within(within(input()).getByRole("group", { name: "토론" })).getAllByRole("button")).toHaveLength(4);
    expect(within(within(input()).getByRole("group", { name: "요약" })).getAllByRole("button")).toHaveLength(3);
    fireEvent.click(within(screen.getByRole("group", { name: "반 전체 · 토론" })).getByRole("button", { name: "잘함" }));
    const st = loadState();
    expect(st.inputs.S01.grades["국어|1|토론"].level).toBe("g");
    expect(st.inputs.S03.grades["국어|1|토론"].level).toBe("g");
  });

  test("평가계획이 없으면 막다른 화면 대신 그 자리에서 넣으러 가는 버튼", () => {
    seed({ plan: [] });
    const goTo = vi.fn();
    render(<AppStateProvider goTo={goTo}><Work active /></AppStateProvider>);
    fireEvent.click(screen.getByRole("tab", { name: "교과 평어" }));
    fireEvent.click(within(input()).getByRole("button", { name: "평가계획 넣기" }));
    expect(goTo).toHaveBeenCalledWith("설정", "plan");
  });

  test("홈에서 항목을 골라 오면 그 항목이 열린다", () => {
    seed();
    open(null, { focus: { value: "A", n: 1 } });
    expect(screen.getByRole("tab", { name: "교과 평어" }).getAttribute("aria-selected")).toBe("true");
  });
});

describe("생성", () => {
  test("키 없이: 같은 자리에서 프롬프트 복사 → 답 붙여넣기 → 저장하면 오른쪽에 초안이 뜬다", async () => {
    seed({ chips: true });
    open("행발");
    fireEvent.click(within(draftBox()).getByRole("button", { name: "프롬프트 복사" }));
    await waitFor(() => expect(copied).toHaveLength(1));
    expect(copied[0]).toContain("[학생 ID] S01");
    expect(copied[0]).not.toContain("김지수");
    fireEvent.change(screen.getByLabelText("답 붙여넣기"), {
      target: { value: '{"student_id":"S01","section":"C","draft":"발표를 즐김.","evidence":[],"warnings":[],"missing":[]}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "답 저장" }));
    expect(loadState().drafts.S01.C).toMatchObject({ draft: "발표를 즐김.", reviewed: false });
    expect(screen.getByLabelText("초안").value).toBe("발표를 즐김.");
    expect(screen.getByRole("button", { name: "1번 김지수 · 초안 있음" })).toBeTruthy();
  });

  test("다른 학생 답이면 저장 전에 확인한다", () => {
    seed({ chips: true });
    let asked = "";
    window.confirm = (m) => { asked = m; return false; };
    open("행발");
    fireEvent.change(screen.getByLabelText("답 붙여넣기"), { target: { value: '{"student_id":"S09","draft":"가"}' } });
    fireEvent.click(screen.getByRole("button", { name: "답 저장" }));
    expect(asked).toContain("S09");
    expect(loadState().drafts.S01).toBeUndefined();
  });

  test("입력이 없는 학생은 생성 대신 먼저 고르라고 안내", () => {
    seed();
    open("행발");
    expect(within(draftBox()).getByText(/가운데에서 먼저 골라 주세요/)).toBeTruthy();
    expect(within(draftBox()).queryByRole("button", { name: "프롬프트 복사" })).toBeNull();
  });

  test("키가 있으면 입력된 학생 전체 생성: 대상은 입력된 학생만, 진행률과 멈춤, 이어서 하기", async () => {
    seed({ key: "k" });
    const s = loadState();
    const id = s.chips.C[0].id;
    s.inputs = { S01: { chipsC: { [id]: "2026-11-17" } }, S03: { chipsC: { [id]: "2026-11-17" } } };
    saveState(s);
    let resolveRun;
    runBatch.mockImplementation(({ pseudoIds, onResult, onStatus, signal }) => {
      onResult(pseudoIds[0], { student_id: "S01", section: "C", draft: "가.", evidence: [], warnings: [], missing: [], idMismatch: false });
      onStatus("2 / 2 쓰는 중");
      return new Promise((r) => { resolveRun = () => r({ done: [pseudoIds[0]], pausedAt: signal.aborted ? pseudoIds[1] : null }); });
    });
    open("행발");
    fireEvent.click(screen.getByRole("button", { name: "입력된 학생 전체 생성 (2명)" }));
    expect(await screen.findByText("2 / 2 쓰는 중")).toBeTruthy();
    expect(screen.getByText("1 / 2 완료")).toBeTruthy();
    expect(loadState().drafts.S01.C.draft).toBe("가.");
    const call = runBatch.mock.calls[0][0];
    expect(call.pseudoIds).toEqual(["S01", "S03"]);
    fireEvent.click(screen.getByRole("button", { name: "멈춤" }));
    expect(call.signal.aborted).toBe(true);
    resolveRun();
    fireEvent.click(await screen.findByRole("button", { name: "이어서 하기" }));
    expect(runBatch.mock.calls[1][0].pseudoIds).toEqual(["S03"]);
  });

  test("전체 생성 중 다른 항목을 봐도 결과는 시작한 항목에 저장된다", async () => {
    seed({ key: "k", chips: true });
    let finish;
    runBatch.mockImplementation(({ pseudoIds, onResult }) => new Promise((r) => {
      finish = () => { onResult(pseudoIds[0], { student_id: "S01", draft: "행발 글.", evidence: [], warnings: [], missing: [], idMismatch: false }); r({ done: [pseudoIds[0]], pausedAt: null }); };
    }));
    open("행발");
    fireEvent.click(screen.getByRole("button", { name: /입력된 학생 전체 생성/ }));
    fireEvent.click(screen.getByRole("tab", { name: "통지표" }));
    finish();
    await waitFor(() => expect(loadState().drafts.S01.C.draft).toBe("행발 글."));
    expect(loadState().drafts.S01.D).toBeUndefined();
  });

  test("키가 있어도 복사·붙여넣기로 하기를 고르면 같은 자리에 복사 칸", () => {
    seed({ key: "k", chips: true });
    open("행발");
    expect(within(draftBox()).getByRole("button", { name: "이 학생 생성" })).toBeTruthy();
    fireEvent.click(screen.getByLabelText("복사·붙여넣기로 하기"));
    expect(within(draftBox()).getByRole("button", { name: "프롬프트 복사" })).toBeTruthy();
  });
});

const reviewSeed = (draft, names) => seed({ names, drafts: { S01: { C: { draft, evidence: [{ sentence: "가", source: "칩: 발표 잘함" }], warnings: ["근거 약함"], missing: [], reviewed: false } } } });

describe("검토", () => {
  test("체크해야 복사가 켜지고, 고치면 다시 꺼진다", () => {
    reviewSeed("발표를 즐김.");
    open("행발");
    const copy = within(draftBox()).getByRole("button", { name: "복사" });
    expect(copy.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("검토 완료"));
    expect(copy.disabled).toBe(false);
    expect(loadState().drafts.S01.C.reviewed).toBe(true);
    expect(screen.getByRole("button", { name: "1번 김지수 · 검토 완료" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("초안"), { target: { value: "발표를 즐겨 함." } });
    expect(copy.disabled).toBe(true);
    expect(screen.getByText("근거 약함")).toBeTruthy();
  });

  test("AI가 넣은 가명은 화면에서 실명으로 보이고 경고, 복사도 보이는 글", async () => {
    reviewSeed("S02와 협력함.");
    open("행발");
    expect(screen.getByLabelText("초안").value).toBe("박민와 협력함.");
    expect(screen.getByText(/초안에 학생 ID\(S01 같은 가명\)가 들어 있어요/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("검토 완료"));
    fireEvent.click(within(draftBox()).getByRole("button", { name: "복사" }));
    await waitFor(() => expect(copied).toEqual(["박민와 협력함."]));
  });

  test("고친 글은 보이는 그대로 저장되고, 이름과 같은 낱말이 망가지지 않는다", () => {
    reviewSeed("성실함.", ["한결"]);
    open("행발");
    fireEvent.change(screen.getByLabelText("초안"), { target: { value: "한결같이 성실함." } });
    expect(loadState().drafts.S01.C.draft).toBe("한결같이 성실함.");
    expect(screen.getByLabelText("초안").value).toBe("한결같이 성실함.");
  });

  test("[보충 필요] 빨간 강조, 목록에 보충 필요, 바이트 초과 표시", () => {
    reviewSeed("[보충 필요: 학기 초 기록] 가" + "나".repeat(600));
    open("행발");
    expect(screen.getByTestId("need-more").textContent).toContain("보충 필요");
    expect(screen.getByRole("button", { name: "1번 김지수 · 보충 필요" })).toBeTruthy();
    const counter = screen.getByTestId("byte-counter");
    expect(counter.textContent).toMatch(/\/ 1500/);
    expect(counter.className).toContain("text-red");
  });

  test("검토 완료된 것 번호순 모두 복사", async () => {
    seed({ drafts: { S01: { C: { draft: "가.", reviewed: true } }, S02: { C: { draft: "나.", reviewed: false } } } });
    open("행발");
    fireEvent.click(screen.getByRole("button", { name: "검토 완료 1명 모두 복사" }));
    await waitFor(() => expect(copied).toEqual(["1\t가."]));
  });
});
