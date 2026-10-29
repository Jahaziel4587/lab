import type { InventorySite } from "./sites";
/** ISO weeks start on Monday; use the local plant date, including at year boundaries. */
export function voucherWeek(instant: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(instant));
  const part = (key: string) => Number(parts.find(p => p.type === key)!.value);
  const date = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const year = date.getUTCFullYear();
  const week = Math.ceil(((date.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return { year, week, key: `${year}-${String(week).padStart(2, "0")}` };
}
export function voucherPrefix(site: InventorySite, instant: string) {
  const { week, year } = voucherWeek(instant);
  return `VL.${site}.${String(week).padStart(2, "0")}${String(year).slice(-2)}-`;
}
export function sequenceLetters(index: number): string {
  if (!Number.isSafeInteger(index) || index < 1) throw new Error("Consecutivo inválido.");
  let result = "";
  for (; index > 0; index = Math.floor((index - 1) / 26)) result = String.fromCharCode(65 + (index - 1) % 26) + result;
  return result;
}
function sequenceIndex(letters: string) { return [...letters].reduce((n, letter) => n * 26 + letter.charCodeAt(0) - 64, 0); }
export type NumberingEntry = { id: string; confirmedTitle?: string; excluded?: boolean };
export type NumberingLedger = { prefix: string; entries: NumberingEntry[] };
/** Insertion order is the transaction commit order, even for simultaneous creation. */
export function numberingSuggestions(ledger: NumberingLedger) {
  const reserved = new Set(ledger.entries.filter(e => e.confirmedTitle).map(e => e.confirmedTitle!));
  const result: Record<string, string> = {};
  let next = 1;
  for (const entry of ledger.entries) {
    if (entry.excluded) continue;
    if (entry.confirmedTitle) {
      if (entry.confirmedTitle.startsWith(ledger.prefix)) next = Math.max(next, sequenceIndex(entry.confirmedTitle.slice(ledger.prefix.length)) + 1);
      continue;
    }
    while (reserved.has(ledger.prefix + sequenceLetters(next))) next++;
    result[entry.id] = ledger.prefix + sequenceLetters(next++);
  }
  return result;
}
export function confirmNumbering(ledger: NumberingLedger, id: string, title: string, expected: string) {
  const entry = ledger.entries.find(e => e.id === id);
  if (!entry || entry.excluded || entry.confirmedTitle) throw new Error("El estado del vale cambió. Recarga antes de confirmar.");
  const suggestions = numberingSuggestions(ledger);
  if (suggestions[id] !== expected) throw new Error("La sugerencia cambió. Recarga el vale antes de confirmar.");
  if (!title.startsWith(ledger.prefix) || !/^[A-Z]{1,6}$/.test(title.slice(ledger.prefix.length))) throw new Error(`Usa un ID con formato ${ledger.prefix}A.`);
  if (ledger.entries.some(e => e.id !== id && (e.confirmedTitle === title || suggestions[e.id] === title))) throw new Error("Ese ID ya está confirmado o sugerido para otro vale.");
  entry.confirmedTitle = title;
}
export function voucherDisplayTitle(voucher: { id: string; title?: string; suggestedTitle?: string; numberingStatus?: string }) {
  return voucher.title || voucher.suggestedTitle || `Vale · ${voucher.id.slice(-8)}`;
}
