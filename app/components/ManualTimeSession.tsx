"use client";
import { useRef, useState } from "react";
import { useAuth } from "@/src/Context/AuthContext";
import { manualTimeRange } from "@/lib/time-tracking/shared";

export default function ManualTimeSession({ onSaved, onCancel }: { onSaved: (month: string) => Promise<void>; onCancel: () => void }) {
  const { user } = useAuth();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef({ payload: "", id: "" });
  const input = "mt-1.5 min-h-12 w-full min-w-0 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none focus:border-emerald-300/50 [color-scheme:dark]";
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!user || busy) return;
    setError("");
    try { manualTimeRange(start, end, Date.now()); }
    catch (e) { setError(e instanceof Error ? e.message : "Revisa el rango de tiempo."); return; }
    const payload = JSON.stringify({ start, end, title });
    if (attempt.current.payload !== payload) attempt.current = { payload, id: crypto.randomUUID() };
    setBusy(true);
    try {
      const response = await fetch("/api/time-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ action: "manual", start, end, title, requestId: attempt.current.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo guardar la sesión.");
      await onSaved(start.slice(0, 7));
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar la sesión."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
    <h3 className="text-sm font-semibold">Registrar horas manualmente</h3>
    <p className="mt-1 text-xs text-white/45">Selecciona el rango trabajado en horario de Monterrey.</p>
    <fieldset disabled={busy} className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
      <label className="min-w-0 text-xs font-medium text-white/65">Inicio · fecha y hora<input type="datetime-local" required value={start} onChange={e => setStart(e.target.value)} className={input} /></label>
      <label className="min-w-0 text-xs font-medium text-white/65">Fin · fecha y hora<input type="datetime-local" required value={end} onChange={e => setEnd(e.target.value)} className={input} /></label>
      <label className="text-xs font-medium text-white/65 sm:col-span-2">Actividad o título (opcional)<input maxLength={200} value={title} onChange={e => setTitle(e.target.value)} className={input} placeholder="¿En qué trabajaste?" /></label>
    </fieldset>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    <div className="mt-4 flex flex-wrap gap-2"><button type="submit" disabled={busy || !user} className="min-h-11 rounded-xl bg-emerald-300 px-5 py-2 text-sm font-semibold text-black disabled:opacity-40">{busy ? "Guardando…" : "Guardar sesión"}</button><button type="button" disabled={busy} onClick={onCancel} className="min-h-11 rounded-xl border border-white/15 px-4 py-2 text-sm text-white/65 disabled:opacity-40">Cancelar</button></div>
  </form>;
}
