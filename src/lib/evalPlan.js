import * as XLSX from "xlsx";

export const EVAL_HEADERS = ["교과", "영역(단원)", "성취기준 코드", "평가요소", "매우잘함", "잘함", "보통", "노력요함"];

// 탭 구분 텍스트를 칸 배열로 (엑셀·한글에서 복사하면 줄바꿈이 든 칸은 따옴표로 싸여 온다)
function splitTSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const s = String(text ?? "").replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === "\t") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const clean = (v) => String(v ?? "").replace(/\s*\n\s*/g, " ").trim();

function rowsFromCells(cells) {
  const rows = [];
  let skipped = 0;
  let subject = "";
  let area = "";
  for (const raw of cells) {
    const c = Array.from({ length: 8 }, (_, i) => clean(raw[i]));
    if (c.every((v) => v === "")) continue;
    if (c[0] === "교과") continue;
    subject = c[0] || subject;
    area = c[1] || area;
    const [, , code, element, vg, g, n, e] = c;
    if (!subject || !element || !g || !n || !e) { skipped += 1; continue; }
    rows.push({ id: `${subject}|${code}|${element}`, subject, area, code, element, levels: { vg, g, n, e } });
  }
  return { rows, skipped };
}

export function parseEvalPlanTSV(text) {
  return rowsFromCells(splitTSV(text));
}

export function parseEvalPlanXlsx(buf) {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const cells = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
  return rowsFromCells(cells);
}

export function subjectsOf(rows) {
  const out = [];
  for (const r of rows) if (!out.includes(r.subject)) out.push(r.subject);
  return out;
}
