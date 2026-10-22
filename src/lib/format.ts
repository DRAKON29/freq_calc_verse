/** Детерминированное форматирование чисел (запятая как разделитель, U+2212 для минуса) */
export function fmt(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  const s = Math.abs(value).toFixed(digits).replace(".", ",");
  return (value < 0 ? "−" : "") + s;
}

export function fmtSigned(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return (value >= 0 ? "+" : "−") + fmt(Math.abs(value), digits);
}
