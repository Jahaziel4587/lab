"use client";
export default function TimeMonthFilter({ value, months, onChange }: { value: string; months: string[]; onChange: (value: string) => void }) {
  return <label className="flex flex-col gap-1.5 text-xs font-medium text-white/60">
    Filtrar por mes
    <select value={value} onChange={event => onChange(event.target.value)} className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white outline-none transition hover:bg-white/[0.08] focus:border-emerald-400/40 sm:w-[220px] [&>option]:bg-zinc-950">
      {[...new Set([value, ...months])].sort().reverse().map(month => <option key={month} value={month}>{monthLabel(month)}</option>)}
    </select>
  </label>;
}
export function monthLabel(month: string) {
  const label = new Date(`${month}-01T12:00:00Z`).toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
