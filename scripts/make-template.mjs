// 평가계획 양식(public/평가계획_양식.xlsx)을 만든다: node scripts/make-template.mjs
import * as XLSX from "xlsx";
import { writeFileSync } from "node:fs";
import { EVAL_HEADERS } from "../src/lib/evalPlan.js";

const rows = [
  EVAL_HEADERS,
  ["국어", "듣기·말하기", "6국01-03", "토론하기",
    "토론의 절차와 규칙을 지키며 타당한 근거를 들어 주장을 논리적으로 펼침",
    "토론의 절차를 지키며 근거를 들어 주장을 펼침",
    "토론에 참여하여 자신의 주장을 말함",
    "도움을 받아 토론에 참여함"],
  ["국어", "읽기", "6국02-02", "글 요약하기",
    "",
    "글의 구조를 파악하여 내용을 요약함",
    "글의 중심 내용을 찾아 간추림",
    "도움을 받아 중심 내용을 찾음"],
];

const ws = XLSX.utils.aoa_to_sheet(rows);
ws["!cols"] = [8, 12, 12, 14, 40, 40, 40, 40].map((wch) => ({ wch }));
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "평가계획");
writeFileSync("public/평가계획_양식.xlsx", XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
console.log("public/평가계획_양식.xlsx 만들었어요 (예시 2행: 4단계 1, 3단계 1)");
