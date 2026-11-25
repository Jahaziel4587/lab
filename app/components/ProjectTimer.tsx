"use client";
import { useCallback, useEffect, useState } from "react";
import { Play, Square, Download, Timer } from "lucide-react";
import { useAuth } from "@/src/Context/AuthContext";
import { clock, currentMonth, monthBounds, monthDuration, PROJECT, type Session } from "@/lib/time-tracking/shared";

type Data = { sessions: Session[]; active: Session | null; now: number; all: boolean; schedulerActive: boolean };
const button = "rounded-xl border border-white/20 px-4 py-3 text-sm disabled:opacity-40";
export default function ProjectTimer() {
  const { user, isAdmin } = useAuth();
  const [month, setMonth] = useState(currentMonth);
  const [all, setAll] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  const load = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const response = await fetch(`/api/time-tracking?month=${month}&all=${all}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No se pudo cargar el registro.");
    setData(result);
    setOffset(result.now - Date.now());
  }, [user, month, all]);
  useEffect(() => {
    setData(null);
    setTitle(null);
    let mounted = true;
    const refresh = () => load().catch(e => { if (mounted) setError(e.message); });
    refresh();
    const interval = setInterval(refresh, 30000);
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", refresh);
    return () => { mounted = false; clearInterval(interval); document.removeEventListener("visibilitychange", visible); window.removeEventListener("focus", refresh); };
  }, [load]);
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(interval); }, []);
  const change = async (action: string, sessionId?: string, editedTitle = title ?? data?.active?.title ?? "") => {
    if (!user || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/time-tracking", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ action, sessionId, title: editedTitle }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (action === "stop") setTitle(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar."); } finally { setBusy(false); }
  };
  const running = data?.active;
  const bounds = monthBounds(month);
  const serverNow = now + offset;
  const rows = data?.sessions || [];
  const totals = new Map<string, { name: string; ms: number }>();
  for (const row of rows) {
    const total = totals.get(row.uid) || { name: row.name, ms: 0 };
    total.ms += monthDuration(row, bounds, serverNow);
    totals.set(row.uid, total);
  }
  const exportReport = () => {
    const csv = [[PROJECT, month], ["Usuario", "Horas del mes", "Tiempo"], ...[...totals.values()].map(t => [t.name, (t.ms / 3600000).toFixed(4), clock(t.ms)]), [], ["Usuario", "Actividad", "Inicio (Monterrey)", "Fin (Monterrey)", "Horas dentro del mes", "Estado"], ...rows.map(s => [s.name, s.title, date(s.start), s.end ? date(s.end) : "", (monthDuration(s, bounds, serverNow) / 3600000).toFixed(4), s.end ? "Finalizada" : "En curso"])]
      .map(row => row.map(cell => { const value = String(cell ?? ""); return `"${(/^[=+@-]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`; }).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `Horas-proyecto-${month}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  return <section aria-label="Cronómetro del proyecto" className="mb-6 rounded-3xl border border-emerald-300/25 bg-white/[0.04] p-5 sm:mb-8 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="flex items-center gap-2 text-sm text-emerald-300"><Timer size={20} />{PROJECT}</p><p role="timer" className="mt-3 font-mono text-4xl tabular-nums sm:text-5xl">{clock(running ? serverNow - running.start : 0)}</p><p className="mt-2 text-sm text-white/60">{running ? "En curso · Detén el contador cuando termines." : "Listo para registrar tu tiempo."}</p></div>
      <button disabled={busy || !data} onClick={() => change(running ? "stop" : "start", running?.id)} className={`flex min-h-14 items-center gap-2 rounded-2xl px-7 py-4 font-semibold disabled:opacity-40 ${running ? "bg-amber-300 text-black" : "bg-emerald-300 text-black"}`}>{running ? <Square size={20} /> : <Play size={20} />}{busy ? "Guardando…" : running ? "Detener" : "Iniciar"}</button>
    </div>
    <input aria-label="Título opcional de la actividad" placeholder="¿En qué trabajaste? (opcional)" maxLength={200} value={title ?? running?.title ?? ""} onChange={e => setTitle(e.target.value)} className="mt-5 w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm" />
    {running && <button disabled={busy} className="mt-2 text-sm text-emerald-300" onClick={() => change("title", running.id)}>Guardar título</button>}
    <p className="mt-3 text-xs text-white/50">Recibirás un recordatorio por cada hora en tus dispositivos con notificaciones activadas.</p>
    {data && !data.schedulerActive && <p className="mt-2 text-xs text-amber-200">Pendiente conectar el programador de recordatorios. Por ahora se revisan mientras esta página está abierta.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    <button className="mt-5 text-sm text-emerald-300" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Ocultar registro" : "Ver registro mensual"}</button>
    {expanded && <div className="mt-4 border-t border-white/10 pt-4">
      <div className="flex flex-wrap items-center gap-3"><label className="text-sm">Mes <input type="month" value={month} onChange={e => { if (e.target.value) setMonth(e.target.value); }} className="ml-2 rounded-lg border border-white/20 bg-black p-2" /></label>{isAdmin && <label className="text-sm"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /> Todos los usuarios</label>}<button className={button + " flex items-center gap-2"} disabled={!data} onClick={exportReport}><Download size={16} />Descargar reporte CSV</button></div>
      <div className="my-4 flex flex-wrap gap-4">{[...totals.entries()].map(([uid, total]) => <p key={uid} className="text-sm">{total.name} <strong className="ml-2 font-mono">{clock(total.ms)}</strong></p>)}{!rows.length && <p className="text-sm text-white/60">Sin sesiones en este mes.</p>}</div>
      <div className="max-h-80 space-y-3 overflow-y-auto">{[...rows].sort((a,b) => b.start-a.start).map(s => <div key={s.id} className="rounded-xl border border-white/10 p-3 text-sm"><p>{s.name} · {date(s.start)} · {s.end ? clock(monthDuration(s, bounds, serverNow)) : "En curso"}</p><p className="mt-1 text-white/60">{s.title || "Sin título"}</p>{s.uid === user?.uid && <button disabled={busy} className="mt-2 text-emerald-300" onClick={() => { const value = window.prompt("Título de la actividad (opcional)", s.title); if (value !== null) change("title", s.id, value); }}>Editar título</button>}</div>)}</div>
      <p className="mt-3 text-xs text-white/50">Horario de Monterrey. Las sesiones en curso se incluyen hasta este momento.</p>
    </div>}
  </section>;
}
function date(ms: number) { return new Date(ms).toLocaleString("es-MX", { timeZone: "America/Monterrey", dateStyle: "short", timeStyle: "short" }); }
