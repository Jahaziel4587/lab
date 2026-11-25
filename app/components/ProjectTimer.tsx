"use client";
import { useCallback, useEffect, useState } from "react";
import { Play, Square, Timer, ChevronDown, Pencil, Check } from "lucide-react";
import TimeMonthFilter from "./TimeMonthFilter";
import { useAuth } from "@/src/Context/AuthContext";
import { clock, currentMonth, monthBounds, monthDuration, PROJECT, type Session } from "@/lib/time-tracking/shared";

type Data = { sessions: Session[]; active: Session | null; now: number; months: string[]; schedulerActive: boolean };
export default function ProjectTimer() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth);
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
    const response = await fetch(`/api/time-tracking?month=${month}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No se pudo cargar el registro.");
    setData(result);
    setOffset(result.now - Date.now());
  }, [user, month]);
  useEffect(() => {
    setData(null);
    setTitle(null);
    let mounted = true;
    const refresh = () => load().catch(e => { if (mounted) setError(e.message); });
    refresh();
    const interval = setInterval(refresh, 10000);
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
      if (action === "stop" || action === "title") setTitle(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar."); } finally { setBusy(false); }
  };
  const running = data?.active;
  const bounds = monthBounds(month);
  const serverNow = now + offset;
  const rows = data?.sessions || [];
  const total = rows.reduce((sum, row) => sum + monthDuration(row, bounds, serverNow), 0);
  return <section aria-label="Cronómetro del proyecto" className="mb-6 overflow-hidden rounded-3xl border border-emerald-300/20 bg-zinc-950/85 shadow-xl backdrop-blur-xl sm:mb-8">
    <div className="p-5 sm:p-7">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-300/10 p-2.5 text-emerald-300"><Timer size={22} /></span><div><h2 className="text-sm font-semibold text-white">{PROJECT}</h2><p className="mt-0.5 text-xs text-white/45">{running ? "Sesión en curso" : "Registra tu tiempo de trabajo"}</p></div>{running && <span className="ml-auto h-2 w-2 rounded-full bg-emerald-300" aria-label="Activo" />}</div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-5">
        <p role="timer" className="font-mono text-5xl font-light tracking-tight tabular-nums sm:text-6xl">{clock(running ? serverNow - running.start : 0)}</p>
        <button disabled={busy || !data} onClick={() => change(running ? "stop" : "start", running?.id)} className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-8 py-4 font-semibold transition disabled:opacity-40 sm:w-auto ${running ? "bg-amber-300 text-black hover:bg-amber-200" : "bg-emerald-300 text-black hover:bg-emerald-200"}`}>{running ? <Square size={19} /> : <Play size={19} />}{busy ? "Guardando…" : running ? "Detener" : "Iniciar"}</button>
      </div>
      <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3"><Pencil size={15} className="shrink-0 text-white/35" /><input aria-label="Título opcional de la actividad" placeholder="Actividad o título (opcional)" maxLength={200} value={title ?? running?.title ?? ""} onChange={e => setTitle(e.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-white/35" />{running && title !== null && <button aria-label="Guardar título" disabled={busy} className="rounded-lg p-2 text-emerald-300 hover:bg-white/5" onClick={() => change("title", running.id)}><Check size={18} /></button>}</div>
      <p className="mt-3 text-xs text-white/45">Prueba de avisos cada minuto. Detén el contador al terminar tu actividad.</p>
      {data && !data.schedulerActive && <p className="mt-2 text-xs text-amber-200">El programador aún no confirma actividad. Con esta página abierta también se revisan los avisos.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    </div>
    <button className="flex w-full items-center justify-between border-t border-white/10 bg-white/[0.02] px-5 py-4 text-sm hover:bg-white/[0.04] sm:px-7" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><span>Mi registro mensual</span><span className="flex items-center gap-3"><span className="font-mono text-emerald-300">{clock(total)}</span><ChevronDown size={17} className={expanded ? "rotate-180" : ""} /></span></button>
    {expanded && <div className="border-t border-white/10 p-5 sm:p-7">
      <TimeMonthFilter value={month} months={data?.months || []} onChange={setMonth} />
      {!rows.length && <p className="mt-5 text-sm text-white/45">Sin sesiones en este mes.</p>}
      <div className="mt-5 max-h-80 divide-y divide-white/10 overflow-y-auto">{[...rows].sort((a,b) => b.start-a.start).map(s => <div key={s.id} className="py-4 text-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-medium">{s.title || "Sin título"}</p><p className="mt-1 text-xs text-white/45">{date(s.start)}{s.end ? ` — ${date(s.end)}` : " · En curso"}</p></div><span className="shrink-0 font-mono text-emerald-200">{clock(monthDuration(s, bounds, serverNow))}</span></div><button disabled={busy} className="mt-2 flex items-center gap-1.5 text-xs text-white/50 hover:text-emerald-300" onClick={() => { const value = window.prompt("Título de la actividad (opcional)", s.title); if (value !== null) change("title", s.id, value); }}><Pencil size={12} />Editar título</button></div>)}</div>
      <p className="mt-3 text-xs text-white/35">Horario de Monterrey. El total incluye la sesión en curso.</p>
    </div>}
  </section>;
}
function date(ms: number) { return new Date(ms).toLocaleString("es-MX", { timeZone: "America/Monterrey", dateStyle: "short", timeStyle: "short" }); }
