"use client";
import { useInventorySite } from "./InventoryProvider";
import { useState } from "react";
import { parseComponentCode } from "@/lib/operacional/catalog";
import { useProjects } from "@/lib/operacional/client";
import { TYPES } from "@/lib/inventario/catalogs";
import { inventoryRequest } from "@/lib/inventario/service";
import { Field, inputClass, buttonClass, panelClass } from "./InventoryShell";
export default function ComponentForm({ onSaved }: { onSaved: (id: string) => void }) {
  const { site } = useInventorySite();
  const [code,setCode] = useState("");
  const [unit, setUnit] = useState("pz"), [customUnit, setCustomUnit] = useState("");
  const { projects,error:catalogError } = useProjects();
  let inferred = "Escribe el código para identificar proyecto y nivel.";
  try { const parsed = parseComponentCode(code); const project = projects.find(p=>p.code===parsed.projectCode); inferred = `${parsed.type} · ${TYPES[parsed.type as keyof typeof TYPES]} · ${parsed.projectCode ? (project?.name || "Proyecto no registrado") : "Sin proyecto"}`; } catch {}
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <form className={`${panelClass} space-y-5`} onSubmit={async e => {
    e.preventDefault();
    const selectedUnit = unit === "other" ? customUnit.trim() : unit;
    if (!selectedUnit) { setError("Especifica la unidad de medida."); return; }
    const form = e.currentTarget; const data = Object.fromEntries(new FormData(form)); setBusy(true); setError("");
    try { const r = await inventoryRequest<{ id: string }>({ action: "component", ...data, unit: selectedUnit, site }); form.reset(); setCode(""); setUnit("pz"); setCustomUnit(""); onSaved(r.id); } catch (err) { setError(err instanceof Error ? err.message : "Error."); } finally { setBusy(false); }
  }}><div className="border-b border-white/10 pb-4"><h2 className="text-lg font-semibold">Nuevo artículo</h2><p className="mt-1 text-xs text-white/45">Información general del material o componente.</p></div><div className="grid gap-4 sm:grid-cols-2">
    <Field label="Código"><input name="code" value={code} onChange={e=>setCode(e.target.value)} required maxLength={100} className={inputClass} placeholder="004.308 / MTS-001" /></Field>
    <Field label="Nombre"><input name="name" required maxLength={200} className={inputClass} /></Field>
    <p className="text-sm text-white/55 sm:col-span-2">{inferred}{catalogError && ` · ${catalogError}`}</p>
    <Field label="Unidad"><select name="unit" disabled={busy} value={unit} onChange={e => setUnit(e.target.value)} className={inputClass}>{["pz", "caja", "roll", "m", "kg", "g", "L", "mL"].map(u => <option key={u}>{u}</option>)}<option value="other">Otro</option></select></Field>
    {unit === "other" && <Field label="Especificar unidad de medida"><input disabled={busy} required maxLength={100} value={customUnit} onChange={e => setCustomUnit(e.target.value)} className={inputClass} placeholder="Ej. bolsa de 100 piezas" /><span className="block text-xs text-white/40">Se conservará esta descripción en el inventario, Excel y vales. Las cantidades se capturan en esta unidad.</span></Field>}
  </div>{error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{error}</p>}<button disabled={busy} className={buttonClass}>{busy ? "Guardando…" : "Crear artículo"}</button></form>;
}
