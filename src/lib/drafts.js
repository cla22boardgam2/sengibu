export const ID_MISMATCH_WARNING = "AI가 다른 학생 ID로 답했어요 — 내용이 이 학생 것인지 확인 필요";

// AI 결과를 초안으로 저장 (새 초안은 항상 검토 전 상태)
export function saveDraft(state, pseudoId, key, result) {
  const warnings = [...(result.warnings || [])];
  if (result.idMismatch && !warnings.includes(ID_MISMATCH_WARNING)) warnings.unshift(ID_MISMATCH_WARNING);
  const entry = {
    draft: result.draft ?? "",
    evidence: result.evidence || [],
    warnings,
    missing: result.missing || [],
    reviewed: false,
    updatedAt: new Date().toISOString(),
  };
  return { ...state, drafts: { ...state.drafts, [pseudoId]: { ...(state.drafts[pseudoId] || {}), [key]: entry } } };
}

export function patchDraft(state, pseudoId, key, patch) {
  const cur = state.drafts[pseudoId]?.[key];
  if (!cur) return state;
  return { ...state, drafts: { ...state.drafts, [pseudoId]: { ...state.drafts[pseudoId], [key]: { ...cur, ...patch } } } };
}

export const hasStudentId = (text) => /S\d{2,}(?!\d)/.test(String(text ?? ""));
