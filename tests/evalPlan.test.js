import { readFileSync, existsSync } from "node:fs";
import * as XLSX from "xlsx";
import { EVAL_HEADERS, parseEvalPlanTSV, parseEvalPlanXlsx, subjectsOf } from "../src/lib/evalPlan.js";

const tsv = [
  "교과\t영역(단원)\t성취기준 코드\t평가요소\t매우잘함\t잘함\t보통\t노력요함",
  "국어\t듣기·말하기\t6국01-03\t토론하기\tA\tB\tC\tD",
  "\t\t6국02-02\t요약하기\t\tB2\tC2\tD2",
  "",
  "수학\t수와 연산\t6수01-01\t\tA\tB\tC\tD",
].join("\n");

test("머리글·빈 줄을 건너뛰고, 빈 교과·영역은 윗행을 이어받고, 불완전한 줄은 버린다", () => {
  const { rows, skipped } = parseEvalPlanTSV(tsv);
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    subject: "국어", area: "듣기·말하기", code: "6국01-03", element: "토론하기",
    levels: { vg: "A", g: "B", n: "C", e: "D" },
  });
  expect(rows[1]).toMatchObject({ subject: "국어", area: "듣기·말하기", levels: { vg: "", g: "B2" } });
  expect(skipped).toBe(1);
  expect(subjectsOf(rows)).toEqual(["국어"]);
});

test("다시 읽어도 같은 id", () => {
  expect(parseEvalPlanTSV(tsv).rows[0].id).toBe(parseEvalPlanTSV(tsv).rows[0].id);
  expect(parseEvalPlanTSV(tsv).rows[0].id).not.toBe(parseEvalPlanTSV(tsv).rows[1].id);
});

test("윈도 줄바꿈과 따옴표로 싸인 칸 안 줄바꿈", () => {
  const text = '국어\t문학\t6국05-01\t"작품\n감상"\tA\tB\tC\tD\r\n';
  const { rows } = parseEvalPlanTSV(text);
  expect(rows).toHaveLength(1);
  expect(rows[0].element).toBe("작품 감상");
});

test("엑셀 파일도 같은 규칙으로 읽는다", () => {
  const aoa = tsv.split("\n").map((l) => l.split("\t"));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "평가계획");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const { rows, skipped } = parseEvalPlanXlsx(buf);
  expect(rows).toEqual(parseEvalPlanTSV(tsv).rows);
  expect(skipped).toBe(1);
});

test("앱이 주는 양식 파일은 머리글이 맞고 예시 2행이 읽힌다", () => {
  const path = "public/평가계획_양식.xlsx";
  expect(existsSync(path)).toBe(true);
  const buf = readFileSync(path);
  const wb = XLSX.read(buf);
  const first = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })[0];
  expect(first).toEqual(EVAL_HEADERS);
  expect(parseEvalPlanXlsx(buf).rows).toHaveLength(2);
});

test("머리글 첫 칸이 '과목'이어도 머리글로 본다", () => {
  const text = "과목\t영역\t코드\t평가요소\t매우잘함\t잘함\t보통\t노력요함\n국어\t읽기\t1\t요약\tA\tB\tC\tD";
  expect(subjectsOf(parseEvalPlanTSV(text).rows)).toEqual(["국어"]);
});

test("교과가 바뀌면 영역을 이어받지 않는다", () => {
  const text = "국어\t듣기\t1\t토론\tA\tB\tC\tD\n수학\t\t2\t나눗셈\tA\tB\tC\tD";
  expect(parseEvalPlanTSV(text).rows[1].area).toBe("");
});
