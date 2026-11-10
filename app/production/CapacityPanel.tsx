"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/src/Context/AuthContext";
import type { InventorySite } from "@/lib/inventario/sites";
import type { projectCapacity } from "@/lib/production/project-capacity";
import { Field, inputClass, secondaryButtonClass } from "@/app/components/inventario/InventoryShell";

type Result = ReturnType<typeof projectCapacity>;
const format = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 6 });
const n = (value: number) => format.format(value);
function runs(batches: number[]) {
  const counts = new Map<number, number>();
  for (const units of batches) counts.set(units, (counts.get(units) || 0) + 1);
  return [...counts].map(([units, count]) => `${n(count)} × ${n(units)}`).join(" + ");
}

export default function CapacityPanel({ projectId, projectTitle, initialSite, onSelectWi }: {
  projectId: string; projectTitle: string; initialSite: InventorySite; onSelectWi: (id: string, site: InventorySite) => void;
}) {
  const { user } = useAuth();
  const [site, setSite] = useState(initialSite), [input, setInput] = useState(""), [target, setTarget] = useState("");
  const [refresh, setRefresh] = useState(0), [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setResult(null); setLoading(true); setError("");
    async function load() {
      if (!user) throw new Error("Inicia sesión.");
      const q = new URLSearchParams({ site, projectId });
      if (target) q.set("target", target);
      const r = await fetch(`/api/production/capacity?${q}`, {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` }, signal: controller.signal,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (!controller.signal.aborted) setResult(d);
    }
    void load().catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user, projectId, site, target, refresh]);

  return <div className="space-y-5">
    <p className="text-sm text-white/60">{projectTitle} · Estimación con existencias disponibles de un solo almacén, incluyendo scrap y un lote por insumo en cada corrida. Las WI sin salida registrada se consideran una vez por dispositivo. La consulta no reserva material ni crea PDO.</p>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); setTarget(input); setRefresh(v => v + 1); }}>
      <Field label="Almacén"><select className={inputClass} value={site} onChange={e => setSite(e.target.value as InventorySite)}><option>B1</option><option>B2</option></select></Field>
      <Field label="Meta de dispositivos"><input className={inputClass} type="number" min={1} max={1e9} step={1} value={input} placeholder="Capacidad actual" onChange={e => setInput(e.target.value)} /></Field>
      <button className={secondaryButtonClass} type="submit">Calcular</button>
    </form>
    {loading && <p role="status" className="text-sm text-white/60">Consultando recetas e inventario…</p>}
    {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
    {result && <>
      <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
        <p className="text-sm text-white/65">Capacidad estimada con inventario de {site}</p>
        <p className="mt-1 text-2xl font-semibold text-emerald-200">{result.capacity == null ? "Sin cálculo completo" : `${n(result.capacity)} dispositivos`}</p>
        {!!result.bottlenecks.length && <p className="mt-2 text-sm text-amber-200">Limitantes: {[...new Set(result.bottlenecks.map(b => `${b.wi} · ${b.code}`))].join("; ")}</p>}
        {result.issues.map((issue, i) => <p key={i} className="mt-2 text-sm text-amber-200">{issue}</p>)}
      </div>
      {result.plan && <p className="text-sm text-white/65">Plan para <strong className="text-white">{n(result.goal)} dispositivos</strong>. Las salidas previstas están condicionadas a fabricar primero las WI que las producen. El desglose es una propuesta por lotes.</p>}
      {result.plan?.overflow && <p role="alert" className="text-sm text-amber-200">La meta supera el límite de cálculo. Prueba con una cantidad menor.</p>}
      {(result.plan?.rows.length ? result.plan.rows.map(row => result.standalone.find(w => w.id === row.id)!) : result.standalone).map(wi => {
        const row = result.plan?.rows.find(r => r.id === wi.id);
        return <article key={wi.id} className="space-y-3 rounded-xl border border-white/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{wi.title}</h3>
            <button className={secondaryButtonClass} onClick={() => onSelectWi(wi.id, site)}>Abrir WI</button>
          </div>
          <p className="text-sm text-white/65">{wi.missing ? "Receta pendiente o incompleta." : `${n(wi.batches.reduce((sum, units) => sum + units, 0))} ejecuciones usando solo inventario, si se evalúa esta WI por separado.`}</p>
          {row && <p className="text-sm text-white/80">{n(row.executions)} ejecuciones para la meta{row.output ? ` · Salida prevista: ${n(row.output.quantity)} pz de ${row.output.code} (${row.output.name})` : ""}.</p>}
          {!!row?.batches.length && <p className="text-sm text-white/65">{row.materials.some(m => m.missing > 0) ? "Corridas previstas al cubrir faltantes" : "Corridas propuestas"}: {runs(row.batches.map(b => b.units))} (corridas × ejecuciones).</p>}
          {!!wi.materials.length && <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-white/55"><tr><th scope="col" className="p-2">Material</th><th scope="col" className="p-2">Ejecuciones por lote en inventario</th>{row && <><th scope="col" className="p-2">Desde almacén</th><th scope="col" className="p-2">Desde otra WI</th><th scope="col" className="p-2">Falta para el plan</th></>}</tr></thead>
              <tbody>{wi.materials.map((m, i) => {
                const detail = row?.materials[i];
                return <tr key={i} className="border-t border-white/10"><td className="p-2">{m.code} · {m.name}</td><td className="p-2">{m.lots.length ? runs(m.lots) : "—"}</td>{detail && <><td className="p-2">{n(detail.fromStock)} {detail.unit}</td><td className="p-2">{n(detail.fromProduction)} {detail.unit}</td><td className={`p-2 ${detail.missing ? "text-amber-200" : ""}`}>{detail.missing ? `${n(detail.missing)} ${detail.unit}` : "—"}</td></>}</tr>;
              })}</tbody>
            </table>
          </div>}
          {!!row?.batches.length && <details className="text-sm text-white/65">
            <summary className="cursor-pointer text-emerald-200">Ver lotes por corrida</summary>
            <ol className="mt-2 list-decimal space-y-2 pl-6">{row.batches.map((batch, i) => <li key={i}>{n(batch.units)} ejecuciones · {batch.lots.join("; ")}</li>)}</ol>
          </details>}
        </article>;
      })}
    </>}
  </div>;
}
