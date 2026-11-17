import { readFileSync } from "node:fs";
import { buildSystemPrompt, neisBytes } from "../src/lib/sengibu-prompt.js";

const norm = (s) => s.replace(/\r\n/g, "\n").trim();

test("프롬프트 파일이 요청서 코드 블록과 완전히 같다", () => {
  const md = norm(readFileSync("생기부앱_개발요청서.md", "utf8"));
  const block = md.split("```javascript\n")[1].split("\n```")[0];
  const file = readFileSync("src/lib/sengibu-prompt.js", "utf8");
  expect(norm(file)).toBe(norm(block));
});

test("neisBytes: 한글 3, 영문 1, 줄바꿈 2", () => {
  expect(neisBytes("가a\n")).toBe(6);
});

test("buildSystemPrompt가 항목 규칙을 끼워 넣는다", () => {
  expect(buildSystemPrompt("B", { area: "진로활동" })).toContain(
    "창의적 체험활동 특기사항 — 진로활동",
  );
  expect(() => buildSystemPrompt("Z")).toThrow();
});
