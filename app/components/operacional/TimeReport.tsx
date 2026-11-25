"use client";
import { useEffect, useState } from "react";
import { Download, Timer } from "lucide-react";
import { useAuth } from "@/src/Context/AuthContext";
import TimeMonthFilter from "@/app/components/TimeMonthFilter";
import { clock, currentMonth, monthBounds, monthDuration, PROJECT, type Session } from "@/lib/time-tracking/shared";

type Report = { sessions: Session[]; months: string[]; now: number };
export default function TimeReport() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    setData(null); setError("");
    async function load() {
      if (!user) return;
      try {
        const response = await fetch(`/api/time-tracking?month=${month}&all=true`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, signal: abort.signal, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "No se pudo cargar el reporte.");
        if (!abort.signal.aborted) setData(result);
      } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "No se pudo cargar el reporte."); }
    }
    void load();
    return () => abort.abort();
  }, [user, month]);
  const bounds = monthBounds(month);
  const totals = new Map<string, { name: string; ms: number; count: number }>();
  for (const session of data?.sessions || []) {
    const total = totals.get(session.uid) || { name: session.name, ms: 0, count: 0 };
    total.ms += monthDuration(session, bounds, data!.now);
    total.count += 1;
    totals.set(session.uid, total);
  }
  const users = [...totals.values()].sort((a, b) => a.name.localeCompare(b.name));
  function download() {
    if (!data) return;
    const rows = [[PROJECT, month], ["Usuario", "Horas del mes", "Tiempo", "Sesiones"], ...users.map(t => [t.name, (t.ms / 3600000).toFixed(4), clock(t.ms), t.count]), [], ["Usuario", "Actividad", "Inicio (Monterrey)", "Fin (Monterrey)", "Horas dentro del mes", "Estado", "Tipo de sesión", "Fecha de registro (Monterrey)"], ...[...data.sessions].sort((a,b) => a.start-b.start).map(s => [s.name, s.title, date(s.start), s.end ? date(s.end) : "", (monthDuration(s, bounds, data.now) / 3600000).toFixed(4), s.end ? "Finalizada" : "En curso", s.source === "manual" ? "Manual" : "Cronómetro", s.createdAt ? date(s.createdAt) : ""])];
    const csv = rows.map(row => row.map(cell => { const value = String(cell ?? ""); return `"${(/^[\s]*[=+@-]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`; }).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `Horas-proyecto-${month}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><Timer size={20} className="text-emerald-300" />Horas del proyecto</h2>
    <p className="mt-2 text-sm text-white/50">Resumen mensual por usuario y detalle de actividades.</p>
    <div className="mt-5 flex flex-wrap items-end gap-3"><TimeMonthFilter value={month} months={data?.months || []} onChange={setMonth} /><button disabled={!data} onClick={download} className="flex min-h-12 items-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-black hover:bg-emerald-200 disabled:opacity-40"><Download size={17} />Descargar CSV</button></div>
    {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
    {!data && !error && <p className="mt-4 text-sm text-white/50">Cargando…</p>}
    {data && <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-white/45"><tr><th className="py-3">Usuario</th><th className="py-3 text-right">Sesiones</th><th className="py-3 text-right">Tiempo del mes</th></tr></thead><tbody>{users.map((total, i) => <tr key={i} className="border-t border-white/10"><td className="py-4">{total.name}</td><td className="text-right text-white/60">{total.count}</td><td className="text-right font-mono text-emerald-200">{clock(total.ms)}</td></tr>)}</tbody></table>{!users.length && <p className="py-4 text-sm text-white/50">Sin sesiones en este mes.</p>}<p className="mt-3 text-xs text-white/40">Horario de Monterrey. Las sesiones activas se contabilizan hasta la carga del reporte.</p></div>}
  </section>;
}
function date(ms: number) { return new Date(ms).toLocaleString("es-MX", { timeZone: "America/Monterrey", dateStyle: "short", timeStyle: "short" }); }
