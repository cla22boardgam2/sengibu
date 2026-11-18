import { neisBytes } from "../lib/sengibu-prompt.js";

// D(통지표)는 글자 수, 나머지는 나이스 바이트
export function limitOf(state, section) {
  if (section === "D") return { unit: "자", max: state.settings.reportMaxChars, count: (t) => [...t].length };
  return { unit: "바이트", max: state.settings.byteLimits[section] ?? null, count: neisBytes };
}

export default function ByteCounter({ text, state, section }) {
  const { unit, max, count } = limitOf(state, section);
  const n = count(text);
  const over = max != null && n > max;
  return (
    <span data-testid="byte-counter" className={`text-xs tabular-nums ${over ? "text-red-600 font-semibold" : "text-slate-500"}`}>
      {n.toLocaleString()}{max != null ? ` / ${max}` : ""} {unit}{over ? " · 넘침" : ""}{max == null ? " (상한 미확인)" : ""}
    </span>
  );
}
