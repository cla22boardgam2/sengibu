import { emptyState, DEFAULT_CHIPS_C, OLD_GROUP_MAP, LEGACY_SUB } from "./defaults.js";

export const STORAGE_KEY = "sengibu:v1";
const BROKEN_KEY = `${STORAGE_KEY}:broken`;
const BACKUP_ERROR = "백업 파일을 읽을 수 없어요";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// 예전(한 단계) 행발 칩을 두 단계 새 목록으로. 학생이 고른 칩과 선생님이 넣은 칩은 "이전 칩"으로 남긴다.
function migrateChipsC(C, inputs) {
  if (!Array.isArray(C) || C.some((c) => c?.sub)) return C;
  const used = new Set();
  for (const inp of Object.values(isObj(inputs) ? inputs : {})) for (const id of Object.keys(inp?.chipsC || {})) used.add(id);
  const isOldDefault = (id) => /^c-\d+-\d+$/.test(id);
  const keep = C.filter((c) => c && (used.has(c.id) || !isOldDefault(c.id))).map((c) => ({
    ...c,
    group: OLD_GROUP_MAP[c.group] || c.group || "학습",
    sub: LEGACY_SUB,
    negative: !!c.negative,
  }));
  const texts = new Set(keep.map((c) => c.text));
  return [...DEFAULT_CHIPS_C.filter((c) => !texts.has(c.text)).map((c) => ({ ...c })), ...keep];
}

// 저장된 값 위에 빠진 칸만 기본값으로 채운다 (예전 구조 호환)
function mergeDefaults(saved) {
  const base = emptyState();
  const out = { ...base, ...saved };
  out.settings = { ...base.settings, ...(isObj(saved.settings) ? saved.settings : {}) };
  out.settings.byteLimits = { ...base.settings.byteLimits, ...(saved.settings?.byteLimits || {}) };
  out.chips = { ...base.chips, ...(isObj(saved.chips) ? saved.chips : {}) };
  for (const k of ["students", "evalPlan", "activities"]) if (!Array.isArray(out[k])) out[k] = base[k];
  for (const k of ["inputs", "drafts"]) if (!isObj(out[k])) out[k] = base[k];
  out.chips.C = migrateChipsC(out.chips.C, out.inputs);
  if (!Number.isInteger(out.nextStudentSeq)) out.nextStudentSeq = base.nextStudentSeq;
  return out;
}

export function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return emptyState();
  }
  if (!raw) return emptyState();
  try {
    const saved = JSON.parse(raw);
    if (!isObj(saved)) throw new Error("not object");
    return mergeDefaults(saved);
  } catch {
    try { localStorage.setItem(BROKEN_KEY, raw); } catch { /* 저장 불가 */ }
    return emptyState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function exportBackup(state) {
  const copy = { ...state, settings: { ...state.settings, geminiKey: "" } };
  return JSON.stringify({ app: "sengibu", version: 1, state: copy }, null, 2);
}

// keepKey: 불러온 뒤에도 지금 브라우저의 API 키는 유지한다
export function importBackup(json, keepKey = "") {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(BACKUP_ERROR);
  }
  if (!isObj(parsed) || parsed.app !== "sengibu" || !isObj(parsed.state)) throw new Error(BACKUP_ERROR);
  const state = mergeDefaults(parsed.state);
  state.settings.geminiKey = keepKey;
  return state;
}
