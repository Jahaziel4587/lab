export const REMINDER_INTERVAL = 60 * 1000; // Temporary one-minute notification test.
export const HOUR = 60 * 60 * 1000;
export const PROJECT = "Proyecto · registro de horas";
export type Session = { id: string; uid: string; name: string; title: string; start: number; end: number | null };
export function monthBounds(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Mes inválido.");
  const [year, m] = month.split("-").map(Number);
  // Monterrey uses UTC-6 year-round. Split sessions at local calendar boundaries.
  return [Date.UTC(year, m - 1, 1, 6), Date.UTC(year, m, 1, 6)];
}
export function currentMonth() {
  const date = new Date(Date.now() - 6 * HOUR);
  return date.toISOString().slice(0, 7);
}
export function monthDuration(session: Session, bounds: number[], now: number) {
  return Math.max(0, Math.min(session.end ?? now, bounds[1]) - Math.max(session.start, bounds[0]));
}
export function clock(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, "0")).join(":");
}
