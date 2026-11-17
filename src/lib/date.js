// 한국 시간 기준 오늘 (toISOString은 UTC라 아침에 하루 전 날짜가 나온다)
export function todayStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
