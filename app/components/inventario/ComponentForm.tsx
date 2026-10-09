"use client";
import { useState } from "react";
import { TYPES } from "@/lib/inventario/catalogs";
import { inventoryRequest } from "@/lib/inventario/service";
import { Field, inputClass, buttonClass, panelClass } from "./InventoryShell";
export default function ComponentForm({ onSaved }: { onSaved: (id: string) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <form className={`${panelClass} space-y-4`} onSubmit={async e => {
    e.preventDefault(); const form = e.currentTarget; const data = Object.fromEntries(new FormData(form)); setBusy(true); setError("");
    try { const r = await inventoryRequest<{ id: string }>({ action: "component", ...data }); form.reset(); onSaved(r.id); } catch (err) { setError(err instanceof Error ? err.message : "Error."); } finally { setBusy(false); }
  }}><h2 className="text-xl font-semibold">Nuevo artículo</h2><div className="grid gap-3 sm:grid-cols-2">
    <Field label="Código"><input name="code" required maxLength={100} className={inputClass} placeholder="004.308 / MTS-001" /></Field>
    <Field label="Nombre"><input name="name" required maxLength={200} className={inputClass} /></Field>
    <Field label="Proyecto (opcional)"><input name="project" maxLength={100} className={inputClass} /></Field>
    <Field label="Tipo"><select name="type" className={inputClass} defaultValue="300">{Object.entries(TYPES).map(([id, name]) => <option key={id} value={id}>{id} · {name}</option>)}</select></Field>
    <Field label="Unidad"><select name="unit" className={inputClass}>{["pz", "caja", "roll", "m", "kg", "g", "L", "mL"].map(u => <option key={u}>{u}</option>)}</select></Field>
  </div>{error && <p role="alert" className="text-red-300">{error}</p>}<button disabled={busy} className={buttonClass}>{busy ? "Guardando…" : "Crear artículo"}</button></form>;
}
