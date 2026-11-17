# 생기부 초안 보조 웹앱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 초등 담임교사가 칩·등급·메모를 입력하면 무료 Gemini API(예비: 복사·붙여넣기)로 학생마다 다른 생기부 초안을 받는 정적 웹앱을 만든다.

**Architecture:** 서버 없는 단일 페이지 앱. 순수 로직(`src/lib/*`)은 화면과 분리해 단위 테스트하고, 화면(`src/screens/*`)은 그 함수들만 호출한다. 모든 상태는 하나의 객체로 localStorage에 저장한다. AI 호출은 `provider.js` 한 파일에만 있다.

**Tech Stack:** Vite + React 18 + Tailwind CSS, Vitest(+jsdom), SheetJS(`xlsx`), GitHub Actions → GitHub Pages. Node 24 / npm 11 / git 2.56 설치 확인됨. `gh` CLI는 없음.

**Spec:** `docs/superpowers/specs/2026-11-17-sengibu-app-design.md` (원본 요청서: `생기부앱_개발요청서.md`)

## Global Constraints

- `src/lib/sengibu-prompt.js`는 요청서의 코드 블록을 **한 글자도 바꾸지 않고** 저장한다. 앱은 `buildSystemPrompt`, `buildUserText`, `SECTION_NAMES`, `neisBytes`만 import한다. `generateDraft`는 호출하지 않는다.
- 학생 실명은 브라우저 밖으로 나가지 않는다: Gemini 요청 본문과 클립보드 프롬프트에는 가명(`S01`…)만.
- API 키는 localStorage에만. 소스·저장소·빌드 결과물에 키를 넣지 않는다.
- 유료 API를 쓰지 않는다. 서버 코드를 만들지 않는다.
- 학생은 한 요청에 한 명. 여러 명을 묶지 않는다.
- 학기 구분 없음. 로그인·DB 없음.
- 화면 문구는 한국어, 해요체.
- Vite `base`는 `./` (GitHub Pages 하위 경로에서 동작).
- localStorage 키: `sengibu:v1`.

## Review Focus

1. **평가계획 붙여넣기에 머리글 행·빈 줄·병합 셀(교과 칸이 첫 행에만 있음)이 섞여 온다** → 머리글·빈 줄은 건너뛰고, 빈 교과/영역 칸은 윗행 값을 이어받는다. (Task 4 테스트)
2. **AI 응답이 JSON이 아니거나, 코드블록에 싸여 있거나, 다른 학생 `student_id`다** → 원문을 초안으로 두고 경고, ID 불일치는 `idMismatch: true`. (Task 5 테스트)
3. **실명이 다른 낱말의 일부다(예: 학생 "지수"와 메모 "지수 계산")** → 치환되더라도 치환 횟수를 알림으로 보여 주고, 긴 이름부터 치환해 "김지수"가 "김S03"이 되지 않게 한다. (Task 3 테스트)
4. **Gemini가 429(속도 제한)·네트워크 오류를 낸다** → 반 전체 생성은 멈추지 않고 기다렸다가 같은 학생부터 재시도, 3회 실패 시 그 학생에서 일시정지. 이미 받은 초안은 보존. (Task 5 테스트)
5. **localStorage가 비었거나 깨진 JSON이거나 예전 구조다** → 빈 상태로 시작하고 깨진 원본은 `sengibu:v1:broken`에 보관. 불러오기 파일이 잘못되면 현재 자료를 건드리지 않는다. (Task 2 테스트)

---

## 자료 구조 (모든 Task 공통)

```js
// state
{
  settings: {
    grade: 5,                     // 숫자
    guideText: "",                // 기재요령 발췌
    classNote: "",                // 반 전체 추가 지시
    length: "normal",             // "short" | "normal" | "long"
    reportMaxChars: 300,
    hasSchoolGuide: false,
    reportGuideText: "",          // 통지표 지침(있으면 extraDocs에 포함)
    byteLimits: { A: null, B: null, C: 1500 },  // null = 미확인
    geminiKey: "",
    geminiModel: ""               // Task 5에서 기본값 결정
  },
  students: [ { pseudoId: "S01", number: 1, name: "김지수" } ],
  nextStudentSeq: 2,              // 가명 번호는 재사용하지 않음
  evalPlan: [ { id, subject, area, code, element, levels: { vg, g, n, e } } ], // vg 빈 문자열이면 3단계
  activities: [ { id, area, name, desc } ],     // area: "자율·자치활동" | "동아리활동" | "진로활동"
  chips: {
    C: [ { id, group, text, negative } ],       // group: 성품|학습|친구|생활|표현|노력할 점
    B: [ { id, text } ]                         // 역할 칩
  },
  inputs: {
    S01: {
      grades: { [evalRowId]: { level: "vg"|"g"|"n"|"e", date } },
      chipsC: { [chipId]: date },
      acts: { [activityId]: { joined: true, roles: { [chipId]: date } } },
      memos: { [draftKey]: [ { id, date /* "" 가능 */, text } ] }
    }
  },
  drafts: { S01: { [draftKey]: { draft, evidence, warnings, missing, reviewed, updatedAt } } }
}
// draftKey: "A:국어" | "B:동아리활동" | "C" | "D"   (D의 메모는 "C" 메모를 함께 씀)
// date: "YYYY-MM-DD"
// level 표시 이름: vg=매우잘함, g=잘함, n=보통, e=노력요함
```

## File Structure

```
index.html, vite.config.js, package.json, tailwind.config.js, postcss.config.js
.github/workflows/deploy.yml
public/평가계획_양식.xlsx          (Task 4에서 스크립트로 생성)
src/main.jsx, src/App.jsx, src/index.css
src/lib/sengibu-prompt.js          요청서 원문 그대로
src/lib/store.js                   상태 불러오기·저장·백업
src/lib/students.js                가명 부여, 실명 치환
src/lib/defaults.js                기본 칩 목록, 빈 상태
src/lib/materials.js               칩·등급·메모 → 프롬프트 입력, 재료 같은 학생 찾기
src/lib/evalPlan.js                평가계획 양식 읽기
src/lib/provider.js                Gemini 호출, 응답 해석, 복사용 프롬프트, 반 전체 실행
src/screens/Settings.jsx, Students.jsx, Inputs.jsx, Generate.jsx, Review.jsx, Backup.jsx
src/components/ChipPicker.jsx, GradeButtons.jsx, MemoList.jsx, ByteCounter.jsx
tests/*.test.js
```

---

### Task 1: 프로젝트 뼈대와 프롬프트 모듈

**Files:**
- Create: `package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `src/index.css`, `.gitignore`
- Create: `src/lib/sengibu-prompt.js`
- Test: `tests/prompt.test.js`

**Interfaces:**
- Produces: `src/lib/sengibu-prompt.js` exports `COMMON_PROMPT`, `SECTION_RULES`, `SECTION_NAMES`, `buildSystemPrompt(section, opts)`, `buildUserText(section, opts, student)`, `neisBytes(str)`. npm scripts: `dev`, `build`, `test` (`vitest run`).

- [ ] **Step 1:** `git init` (기본 브랜치 `main`). `npm create vite@latest . -- --template react`로 뼈대 생성(기존 `docs/`, `생기부앱_개발요청서.md`는 보존). Tailwind, `vitest`, `jsdom`, `xlsx` 설치. `vite.config.js`에 `base: "./"`, `test: { environment: "jsdom" }`.
- [ ] **Step 2:** 요청서 `생기부앱_개발요청서.md`의 ```` ```javascript ```` 블록 내용을 그대로 `src/lib/sengibu-prompt.js`로 추출한다(손으로 옮겨 적지 말고 스크립트로 잘라낸다).
- [ ] **Step 3: 실패하는 테스트 작성** — `tests/prompt.test.js`

```js
import { readFileSync } from "node:fs";
import { buildSystemPrompt, neisBytes } from "../src/lib/sengibu-prompt.js";

test("프롬프트 파일이 요청서 코드 블록과 완전히 같다", () => {
  const md = readFileSync("생기부앱_개발요청서.md", "utf8");
  const block = md.split("```javascript\n")[1].split("\n```")[0];
  const file = readFileSync("src/lib/sengibu-prompt.js", "utf8");
  expect(file.replace(/\r\n/g, "\n").trim()).toBe(block.replace(/\r\n/g, "\n").trim());
});
test("neisBytes: 한글 3, 영문 1, 줄바꿈 2", () => {
  expect(neisBytes("가a\n")).toBe(6);
});
test("buildSystemPrompt가 항목 규칙을 끼워 넣는다", () => {
  expect(buildSystemPrompt("B", { area: "진로활동" })).toContain("창의적 체험활동 특기사항 — 진로활동");
  expect(() => buildSystemPrompt("Z")).toThrow();
});
```

- [ ] **Step 4:** `npm test` → PASS 확인. `npm run build` → 성공 확인.
- [ ] **Step 5:** `App.jsx`에 탭 6개(설정/학생/입력/초안 만들기/결과 검토/백업)만 있는 빈 틀. `npm run dev`로 뜨는지 확인.
- [ ] **Step 6: Commit** — `chore: scaffold app and add prompt module`

---

### Task 2: 상태 저장과 백업

**Files:**
- Create: `src/lib/defaults.js`, `src/lib/store.js`
- Test: `tests/store.test.js`

**Interfaces:**
- Produces:
  - `defaults.js`: `emptyState(): State`, `DEFAULT_CHIPS_C`, `DEFAULT_CHIPS_B`, `LEVEL_NAMES = { vg: "매우잘함", g: "잘함", n: "보통", e: "노력요함" }`, `AREAS = ["자율·자치활동","동아리활동","진로활동"]`
  - `store.js`: `loadState(): State`, `saveState(state): void`, `exportBackup(state): string`, `importBackup(json: string): State` (잘못된 파일이면 `Error("백업 파일을 읽을 수 없어요")`), `STORAGE_KEY = "sengibu:v1"`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
test("빈 저장소면 빈 상태", () => { expect(loadState()).toEqual(emptyState()); });
test("저장한 것을 다시 읽는다", () => { const s = emptyState(); s.settings.grade = 6; saveState(s); expect(loadState().settings.grade).toBe(6); });
test("깨진 JSON이면 빈 상태로 시작하고 원본을 보관", () => {
  localStorage.setItem("sengibu:v1", "{깨짐");
  expect(loadState()).toEqual(emptyState());
  expect(localStorage.getItem("sengibu:v1:broken")).toBe("{깨짐");
});
test("예전 구조에 없는 칸은 기본값으로 채운다", () => {
  localStorage.setItem("sengibu:v1", JSON.stringify({ students: [] }));
  expect(loadState().settings.byteLimits.C).toBe(1500);
});
test("백업 왕복", () => { const s = emptyState(); s.settings.classNote = "x"; expect(importBackup(exportBackup(s))).toEqual(s); });
test("잘못된 백업은 오류", () => { expect(() => importBackup("[]")).toThrow("백업 파일을 읽을 수 없어요"); });
test("백업에 API 키는 넣지 않는다", () => { const s = emptyState(); s.settings.geminiKey = "k"; expect(exportBackup(s)).not.toContain('"k"'); });
```

- [ ] **Step 2:** `npm test` → FAIL 확인.
- [ ] **Step 3:** 구현. `emptyState()`는 위 "자료 구조" 그대로(학생·평가계획·행사 빈 배열, `nextStudentSeq: 1`). `DEFAULT_CHIPS_C`는 6묶음 × 8~10개, 짧은 교사 말투, **묶음 사이 중복 없음**. 예: 성품(예의 바름, 정직함, 차분함, 밝고 긍정적…), 학습(집중 잘함, 공부 잘함, 발표 잘함, 끝까지 해냄…), 친구(교우 관계 좋음, 배려심 많음, 모둠 협력 잘함…), 생활(맡은 일 책임짐, 규칙 잘 지킴, 정리정돈 잘함…), 표현(글쓰기 잘함, 그리기 좋아함, 운동 잘함…), 노력할 점(`negative: true` — 집중 시간 짧음, 발표 자신감 부족, 다툼 잦음, 정리 부족…). `DEFAULT_CHIPS_B`: 사회 맡음, 기록 담당, 자료 준비, 아이디어 제안, 발표, 끝까지 참여, 친구 도움, 뒷정리.
- [ ] **Step 4:** 테스트 추가 — `DEFAULT_CHIPS_C`의 `text`에 중복이 없다. `npm test` → PASS.
- [ ] **Step 5: Commit** — `feat: state storage and backup`

---

### Task 3: 학생 가명과 프롬프트 재료 조립

**Files:**
- Create: `src/lib/students.js`, `src/lib/materials.js`
- Test: `tests/students.test.js`, `tests/materials.test.js`

**Interfaces:**
- Consumes: `State`, `LEVEL_NAMES`, `SECTION_NAMES`
- Produces:
  - `addStudents(state, names: string[]): State` — 빈 줄·앞뒤 공백 제거, `S` + 2자리(100명부터 3자리), `number`는 목록 순번
  - `removeStudent(state, pseudoId): State` — 입력·초안도 함께 삭제, 번호 재사용 안 함
  - `scrubNames(text, students): { text, count }` — 실명 → 가명, 긴 이름부터
  - `toRealNames(text, students): string` — 가명 → 실명 (화면 표시용)
  - `draftKeyOf(section, opts): string`
  - `firstWord(draft): string` — 첫 어절. `"[보충 필요"`로 시작하면 `""`
  - `buildRequest(state, pseudoId, section, opts): { section, opts, student, guideText, extraDocs, scrubbed: number, empty: boolean }` — `student`는 `buildUserText`가 받는 모양
  - `findSameMaterial(state, section, opts): string[][]` — 재료가 완전히 같은 학생 가명 묶음(2명 이상인 묶음만, 재료가 아예 없는 학생은 제외)

**`buildRequest` 규칙 (스펙 6절):**
- A: 그 교과 `evalPlan` 행 중 등급을 고른 것 → log `{ date, text: "평가: ${element} (${code}) — ${LEVEL_NAMES[level]}: ${levels[level]}" }`. `extraDocs` = 그 교과 전체 행을 줄글 표로. `opts = { subject, grade: settings.grade }`.
- B: 그 영역에서 `joined`인 행사 → log `{ date: "", text: "참여: ${name} — 역할: ${역할칩들 또는 '기록 없음'}" }`. 역할 칩 날짜 중 가장 이른 날을 date로. `extraDocs` = `[학교 교육활동 목록]` + 모든 행사(영역·이름·설명).
- C: 고른 칩마다 log `{ date, text: "칩: ${text}" }`.
- D: C의 log 전부 + 모든 교과 등급 log(문구 앞에 교과명). `opts = { maxChars: reportMaxChars, hasSchoolGuide }`. `hasSchoolGuide`면 `extraDocs`에 `reportGuideText`.
- 메모: 날짜 있으면 log `{ date, text }`, 없으면 memo에 줄바꿈으로 이어 붙임.
- log는 날짜 오름차순(빈 날짜는 뒤).
- memo 끝에 `분량: 짧게|보통|길게`, 그다음 `settings.classNote`(있을 때).
- `usedOpenings`: 같은 `draftKey`의 **다른 학생** 초안들의 `firstWord`, 빈 값·중복 제거.
- `otherDrafts`: 이 학생의 다른 `draftKey` 초안을 `{ A: "...", B: "...", C: "..." }`로. 같은 항목이 여럿이면(교과 여러 개) 줄바꿈으로 합침. `"[보충 필요"`로 시작하는 초안은 제외.
- log의 `text`와 memo 전체에 `scrubNames` 적용, 치환 횟수 합을 `scrubbed`로.
- `empty` = log가 0개.

- [ ] **Step 1: 실패하는 테스트 작성** — 핵심 단언:

```js
// students
expect(addStudents(emptyState(), ["김지수", " ", "박민"]).students.map(s => s.pseudoId)).toEqual(["S01", "S02"]);
// 삭제 후 추가해도 번호 재사용 안 함
let s = addStudents(emptyState(), ["가", "나"]); s = removeStudent(s, "S02"); s = addStudents(s, ["다"]);
expect(s.students.map(x => x.pseudoId)).toEqual(["S01", "S03"]);
// 긴 이름부터 치환
const st = [{ pseudoId: "S01", name: "지수" }, { pseudoId: "S02", name: "김지수" }];
expect(scrubNames("김지수와 지수가 다툼", st)).toEqual({ text: "S02와 S01가 다툼", count: 2 });
expect(toRealNames("S02 학생은", st)).toBe("김지수 학생은");
expect(firstWord("토론의 절차와 규칙을")).toBe("토론의");
expect(firstWord("[보충 필요: 관찰 기록 없음]")).toBe("");
// materials: C 칩 → 날짜 있는 log
const r = buildRequest(stateWithChip, "S01", "C", {});
expect(r.student.logs).toContainEqual({ date: "2026-11-17", text: "칩: 발표 잘함" });
expect(r.student.pseudoId).toBe("S01");
expect(JSON.stringify(r)).not.toContain("김지수");      // 실명이 요청에 없다
expect(r.student.memo).toContain("분량: 보통");
// usedOpenings는 다른 학생 것만, otherDrafts는 내 다른 항목만
// 재료 없는 학생: r.empty === true
// findSameMaterial: 칩이 같은 S01,S03 → [["S01","S03"]], 메모 하나 더하면 []
```

- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** — `feat: pseudonyms and prompt material assembly`

---

### Task 4: 평가계획 양식 읽기

**Files:**
- Create: `src/lib/evalPlan.js`, `scripts/make-template.mjs`, `public/평가계획_양식.xlsx`
- Test: `tests/evalPlan.test.js`

**Interfaces:**
- Produces:
  - `EVAL_HEADERS = ["교과","영역(단원)","성취기준 코드","평가요소","매우잘함","잘함","보통","노력요함"]`
  - `parseEvalPlanTSV(text: string): { rows: EvalRow[], skipped: number }`
  - `parseEvalPlanXlsx(buf: ArrayBuffer): { rows, skipped }` — 첫 시트를 TSV와 같은 규칙으로
  - `subjectsOf(rows): string[]` — 처음 나온 순서

**규칙:** 탭으로 칸 나눔. 첫 칸이 "교과"인 줄(머리글)과 빈 줄은 건너뜀. 교과·영역 칸이 비면 윗행 값을 이어받음. 평가요소가 비었거나 잘함·보통·노력요함 중 하나라도 비면 그 줄은 버리고 `skipped`에 셈. `id`는 `교과|코드|평가요소`로 만든 안정된 문자열(같은 양식을 다시 올려도 기존 등급 선택이 유지되게). 칸 안 줄바꿈은 공백으로.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
const tsv = [
  "교과\t영역(단원)\t성취기준 코드\t평가요소\t매우잘함\t잘함\t보통\t노력요함",
  "국어\t듣기·말하기\t6국01-03\t토론하기\tA\tB\tC\tD",
  "\t\t6국02-02\t요약하기\t\tB2\tC2\tD2",   // 교과·영역 이어받기, 3단계
  "",
  "수학\t수와 연산\t6수01-01\t\tA\tB\tC\tD",  // 평가요소 없음 → 버림
].join("\n");
const { rows, skipped } = parseEvalPlanTSV(tsv);
expect(rows).toHaveLength(2);
expect(rows[1]).toMatchObject({ subject: "국어", area: "듣기·말하기", levels: { vg: "", g: "B2" } });
expect(skipped).toBe(1);
expect(subjectsOf(rows)).toEqual(["국어"]);
expect(parseEvalPlanTSV(tsv).rows[0].id).toBe(rows[0].id);   // 다시 읽어도 같은 id
```
xlsx 테스트: SheetJS로 같은 내용의 워크북을 메모리에서 만들어 `parseEvalPlanXlsx`에 넣고 같은 결과.

- [ ] **Step 2:** FAIL 확인 → 구현 → PASS.
- [ ] **Step 3:** `scripts/make-template.mjs` — 머리글 + 예시 2행(국어 4단계 1행, 3단계 1행)으로 `public/평가계획_양식.xlsx` 생성. `node scripts/make-template.mjs` 실행 후 파일이 `parseEvalPlanXlsx`로 2행 읽히는지 테스트 추가.
- [ ] **Step 4: Commit** — `feat: evaluation plan template parsing`

---

### Task 5: AI 호출과 응답 해석

**Files:**
- Create: `src/lib/provider.js`
- Test: `tests/provider.test.js`

**Interfaces:**
- Consumes: `buildRequest`, `buildSystemPrompt`, `buildUserText`
- Produces:
  - `parseDraftResponse(raw, pseudoId, section): Result & { idMismatch: boolean }` — `Result = { student_id, section, draft, evidence[], warnings[], missing[] }`
  - `emptyResult(pseudoId, section): Result` — draft `"[보충 필요: 관찰 기록 없음]"`, missing `["관찰 기록을 먼저 입력하세요."]`
  - `promptParts(req): { system: string, user: string }` — user = `[첨부: 2026학년도 학교생활기록부 기재요령(초등학교) 발췌]\n${guideText}\n\n[첨부: 참고 자료]\n${extraDocs || "없음"}\n\n` + `buildUserText(...)` (요청서 `generateDraft`의 본문 구성과 같은 문구)
  - `buildCopyPrompt(req): string` — `COPY_HEADER + system + "\n\n---\n\n" + user`. `COPY_HEADER = "아래 지침과 자료에 따라 작성해 주세요. 답은 JSON만 출력해 주세요.\n\n"`
  - `callGemini({ key, model, system, user, fetchImpl = fetch }): Promise<string>` — 실패 시 `err.status`에 HTTP 상태
  - `generateOne(state, pseudoId, section, opts, deps?): Promise<Result>` — `empty`면 호출 없이 `emptyResult`
  - `runBatch({ getState, pseudoIds, section, opts, onResult(pseudoId, result), onStatus(msg), signal, deps? }): Promise<{ done: string[], pausedAt: string|null }>`
  - `DEFAULT_GEMINI_MODEL`

- [ ] **Step 1:** Gemini 공식 문서(context7 또는 ai.google.dev)에서 **현재 무료 등급으로 쓸 수 있는 텍스트 모델 이름**, `generateContent` REST 요청·응답 형식, 브라우저 직접 호출(CORS) 가능 여부, 무료 등급 분당 요청 한도를 확인한다. 확인한 값을 `provider.js` 맨 위 주석에 출처 URL·확인 날짜와 함께 적고 `DEFAULT_GEMINI_MODEL`과 `MIN_GAP_MS`(요청 간 최소 간격)를 정한다. 확인이 안 되는 값은 추측하지 말고 작업을 멈추고 보고한다.
- [ ] **Step 2: 실패하는 테스트 작성**

```js
// 응답 해석
expect(parseDraftResponse('```json\n{"student_id":"S01","draft":"가"}\n```', "S01", "C")).toMatchObject({ draft: "가", idMismatch: false, evidence: [], warnings: [], missing: [] });
expect(parseDraftResponse("그냥 글", "S01", "C")).toMatchObject({ draft: "그냥 글", warnings: ["응답이 JSON 형식이 아님 — 직접 확인 필요"] });
expect(parseDraftResponse('{"student_id":"S09","draft":"가"}', "S01", "C").idMismatch).toBe(true);
expect(parseDraftResponse('앞말 {"student_id":"S01","draft":"가"} 뒷말', "S01", "C").draft).toBe("가"); // 앞뒤 군말 허용
// 복사 프롬프트에 시스템 지침·기재요령·가명이 모두 있고 실명은 없다
// generateOne: 재료 없으면 fetch를 부르지 않는다 (fetchImpl mock 호출 0회)
// callGemini: mock fetch가 받은 본문에 system/user 텍스트가 들어 있고, 키는 URL 쿼리가 아니라 헤더로 간다
// runBatch: 2번째 학생에서 429 한 번 → 기다린 뒤(sleep mock) 같은 학생 재시도 → 3명 모두 done
// runBatch: 같은 학생 3회 연속 실패 → pausedAt === 그 학생, 앞 학생 결과는 onResult로 이미 전달됨
// runBatch: 2번째 학생의 요청에는 1번째 학생 초안의 첫 어절이 usedOpenings에 들어 있다 (getState를 매번 다시 부름)
// runBatch: signal.abort() → 진행 중인 학생까지만 하고 멈춤
```

- [ ] **Step 3:** FAIL 확인 → 구현. `deps = { fetchImpl, sleep }` 주입. 429·5xx·네트워크 오류는 재시도(대기: 응답의 재시도 안내가 있으면 그 값, 없으면 20초·40초), 400·401·403은 재시도 없이 즉시 `pausedAt`과 함께 `onStatus("API 키나 모델 이름을 확인해 주세요")`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** — `feat: gemini provider, response parsing, batch runner`

---

### Task 6: 설정·학생·백업 화면

**Files:**
- Create: `src/screens/Settings.jsx`, `src/screens/Students.jsx`, `src/screens/Backup.jsx`, `src/state.jsx`(상태 Context: `useAppState(): [state, update(fn)]`, 바뀔 때마다 `saveState`)
- Modify: `src/App.jsx`
- Test: `tests/screens-basic.test.jsx` (`@testing-library/react` 추가)

**Interfaces:**
- Consumes: Task 2~4의 함수 전부
- Produces: `useAppState()`

**화면 요구 (스펙 7절 1·2·6):**
- 설정: 학년 / 기재요령 발췌 / 평가계획(양식 내려받기 링크 `./평가계획_양식.xlsx`, 파일 올리기, 붙여넣기 칸 → "국어 3개, 수학 2개 읽음 · 1줄 건너뜀" 결과 표시) / 행사 목록(영역·이름·설명 행 추가·삭제) / 행발 칩·역할 칩 편집(추가·삭제) / 통지표 글자 수·지침 유무·지침 텍스트 / 길이 / 반 전체 추가 지시 / 바이트 상한 3칸(비면 "미확인 — 기재요령에서 확인 후 입력") / Gemini 키(비밀번호형 입력)·모델명·키 만드는 법 링크(Google AI Studio) / 고정 안내문 "무료 등급은 보낸 내용이 서비스 개선에 쓰일 수 있어요. 앱은 가명만 보내지만 메모에 민감한 내용은 쓰지 마세요."
- 학생: 여러 줄 붙여넣기 → 가명 부여. 표(번호·가명·실명·삭제). 삭제는 확인창. 안내 "이름은 이 브라우저에만 저장돼요."
- 백업: 내려받기(`생기부_백업_YYYY-MM-DD.json`), 불러오기(확인창 후 교체, 실패 시 현재 자료 유지 + 오류 문구), "자료 내려받고 비우기"(내려받기 후 확인창 → 학생·입력·초안만 비우고 설정·칩·평가계획은 유지).

- [ ] **Step 1: 실패하는 테스트** — (a) 학생 화면에 "김지수\n박민" 붙여넣고 추가 → 표에 S01·S02. (b) 평가계획 붙여넣기 칸에 Task 4의 `tsv` → "국어 2개" 문구. (c) 불러오기에 잘못된 파일 → "백업 파일을 읽을 수 없어요" 표시, 학생 목록 그대로.
- [ ] **Step 2:** 구현 → `npm test` PASS.
- [ ] **Step 3:** `npm run dev`로 브라우저에서 세 화면을 직접 눌러 확인(새로고침 후 값 유지).
- [ ] **Step 4: Commit** — `feat: settings, students, backup screens`

---

### Task 7: 입력 화면 (교과·창체·행발)

**Files:**
- Create: `src/screens/Inputs.jsx`, `src/components/ChipPicker.jsx`, `GradeButtons.jsx`, `MemoList.jsx`
- Test: `tests/inputs.test.jsx`

**Interfaces:**
- Consumes: `useAppState`, `subjectsOf`, `findSameMaterial`, `LEVEL_NAMES`, `AREAS`
- Produces: 없음(상태의 `inputs`만 바꿈)

**화면 요구 (스펙 6절):**
- 위쪽 항목 탭: 교과 / 창체 / 행발. 교과는 교과 탭, 창체는 영역 탭이 한 줄 더.
- 학생 카드가 번호순으로 세로 나열. 카드 제목은 `번호 실명`(화면에서만 실명).
- 교과: 평가요소마다 등급 버튼(그 행이 3단계면 3개). 다시 누르면 해제. 위에 [반 전체 같은 등급] — 평가요소별로 한 번에 적용(확인창).
- 창체: 그 영역 행사마다 참여 체크(기본 체크) + 역할 칩. 위에 [모두 참여]/[모두 빼기].
- 행발: 묶음별 칩. `negative` 칩은 다른 색.
- 칩·등급을 고르면 오늘 날짜로 저장(이미 고른 것은 날짜 유지).
- 메모: 날짜(선택)+내용 줄 추가·수정·삭제, 날짜순. 칸 아래 고정 안내 "이름·연락처·건강·가정 정보는 쓰지 마세요".
- 재료 같은 학생 알림: 화면 위에 "3번과 7번의 재료가 같아요. 메모를 한 줄 더하면 달라져요" (묶음마다 한 줄, 번호로 표시).
- 평가계획·행사가 비었으면 그 탭에 "설정에서 먼저 넣어 주세요" + 설정으로 가는 버튼.

- [ ] **Step 1: 실패하는 테스트** — (a) 행발 칩 클릭 → `inputs.S01.chipsC[chipId]`가 오늘 날짜. (b) 두 학생에 같은 칩 → 알림 문구에 "1번과 2번". 한 학생에 메모 추가 → 알림 사라짐. (c) 3단계 행은 버튼 3개. (d) [반 전체 같은 등급] → 모든 학생 등급 설정.
- [ ] **Step 2:** 구현 → PASS → 브라우저에서 25명 넣고 스크롤·클릭 반응 확인.
- [ ] **Step 3: Commit** — `feat: input screens for grades, activities, chips`

---

### Task 8: 초안 만들기와 결과 검토

**Files:**
- Create: `src/screens/Generate.jsx`, `src/screens/Review.jsx`, `src/components/ByteCounter.jsx`
- Test: `tests/generate-review.test.jsx`

**Interfaces:**
- Consumes: `generateOne`, `runBatch`, `buildCopyPrompt`, `parseDraftResponse`, `buildRequest`, `toRealNames`, `scrubNames`, `neisBytes`, `draftKeyOf`

**초안 만들기 (스펙 5-0, 5절):**
- 항목 선택 A/B/C/D + 옵션(A 교과, B 영역). 학생 선택(전체 또는 일부), "이미 초안 있는 학생 건너뛰기" 체크(기본 켬).
- 키가 있으면: [반 전체 생성] — `runBatch`, 진행률 `7 / 25`, 상태 문구(대기 중 안내 포함), [멈춤], 멈춘 뒤 [이어서 하기]. 학생별 [다시 생성].
- 키가 없으면(또는 "복사·붙여넣기로 하기" 전환): 한 명씩 진행 — [프롬프트 복사](옆에 "새 채팅에 붙여넣으세요") → [답 붙여넣기] 칸 → 저장되면 자동으로 다음 학생.
- 실명 치환이 있었으면 "실명 2곳을 가명으로 바꿔 보냈어요" 알림.
- `idMismatch`면 저장 전 확인창 "다른 학생(S09)의 답 같아요. 그래도 저장할까요?".
- 기존 초안이 `reviewed`면 덮어쓰기 전 확인. 새 초안은 `reviewed: false`.
- `guideText`가 비었으면 생성 전에 "설정에 기재요령 발췌가 없어요. 그래도 진행할까요?".

**결과 검토 (스펙 7절 5):**
- 항목·옵션 선택 → 학생 카드 번호순. 왼쪽: 수정 가능한 초안 칸(가명을 실명으로 바꿔 보여 주고, 저장할 때 `scrubNames`로 되돌림), 바이트 `1,212 / 1500`(상한 넘으면 빨간색, 상한 null이면 숫자만, D는 글자 수 `n / maxChars`). 오른쪽: evidence(문장 ← 근거), warnings, missing.
- "[보충 필요"가 들어 있는 부분은 초안 칸 아래 미리보기에서 빨간색 강조.
- "검토 완료" 체크해야 [복사] 활성화. 초안을 고치면 체크 해제.
- [검토 완료된 것 번호순 모두 복사] — 한 줄에 `번호<TAB>초안`. 복사되는 글은 저장된 초안 그대로다(가명→실명 치환을 하지 않는다. 생기부 문장에는 이름을 쓰지 않으므로, 초안에 가명 `S숫자`가 남아 있으면 그 학생 카드에 "초안에 학생 ID가 들어 있어요" 경고를 띄운다).

- [ ] **Step 1: 실패하는 테스트** — (a) 붙여넣기 흐름: 답 JSON 붙여넣기 → `drafts.S01.C.draft` 저장, 화면이 2번 학생으로. (b) 검토 화면: 체크 전 [복사] disabled, 체크 후 enabled, 초안 수정 시 다시 disabled. (c) 초안 "[보충 필요: x] 가" → 빨간 강조 요소 존재. (d) 1500 초과 → 카운터에 초과 표시 클래스. (e) `runBatch`를 mock한 [반 전체 생성] → 진행률 문구 갱신, [멈춤] 누르면 abort 호출.
- [ ] **Step 2:** 구현 → PASS.
- [ ] **Step 3:** 브라우저에서 복사·붙여넣기 흐름을 가짜 JSON으로 끝까지 한 번 돌려 본다(학생 3명, 항목 C). Gemini 실제 호출은 키가 없으므로 하지 않는다 — 교사가 키를 넣은 뒤 확인할 항목으로 README에 적는다.
- [ ] **Step 4: Commit** — `feat: draft generation and review screens`

---

### Task 9: 배포와 안내

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`

- [ ] **Step 1:** `deploy.yml` — `main`에 push하면 `npm ci` → `npm test` → `npm run build` → `actions/upload-pages-artifact`(`dist`) → `actions/deploy-pages`. 권한 `pages: write`, `id-token: write`.
- [ ] **Step 2:** `README.md`(한국어) — 쓰는 순서(설정 → 학생 → 입력 → 초안 → 검토), Gemini 무료 키 만드는 법, 복사·붙여넣기 모드, 개인정보 원칙(실명은 브라우저에만, 메모 주의), 백업, GitHub Pages 켜는 법(저장소 Settings → Pages → Source: GitHub Actions), **만든 뒤 교사가 확인할 것**: ① 기재 길라잡이에서 항목별 바이트 상한과 한글·줄바꿈 바이트 기준 확인 후 설정에 입력 ② 키를 넣고 학생 1명 실제 생성 확인.
- [ ] **Step 3:** `npm test && npm run build` 통과 확인. `dist/index.html`을 `npx vite preview`로 열어 하위 경로에서도 자산이 뜨는지 확인.
- [ ] **Step 4: Commit** — `chore: pages deploy workflow and readme`
- [ ] **Step 5:** GitHub 저장소 만들기와 push는 교사 계정이 필요하므로 여기서 멈추고 교사에게 저장소 주소를 받는다(`gh` 없음 — `git remote add` + `git push`).
