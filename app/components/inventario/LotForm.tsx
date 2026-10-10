"use client";
import { useInventorySite } from "./InventoryProvider";
import { useRef, useState } from "react";
import { WAREHOUSES, EXTERNAL_LOCATIONS } from "@/lib/inventario/catalogs";
import { inventoryRequest } from "@/lib/inventario/service";
import type { InventoryComponent } from "@/lib/inventario/types";
import { Field, inputClass, buttonClass, panelClass } from "./InventoryShell";
export default function LotForm({ component, onSaved }: { component: InventoryComponent; onSaved: (ids: string[]) => void }) {
  const { site } = useInventorySite();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""); const pending = useRef<{ id: string; signature: string } | null>(null);
  return <form className={`${panelClass} space-y-5`} onSubmit={async e => {
    e.preventDefault(); const form = e.currentTarget; const data = Object.fromEntries(new FormData(form)); const signature = JSON.stringify(data);
    if (!pending.current || pending.current.signature !== signature) pending.current = { id: crypto.randomUUID(), signature };
    setBusy(true); setError("");
    try { const r = await inventoryRequest<{ voucherIds: string[] }>({ action: "lot", componentId: component.id, ...data, quantity: Number(data.quantity), operationId: pending.current.id, site }); pending.current = null; form.reset(); onSaved(r.voucherIds); } catch (err) { setError(err instanceof Error ? err.message : "Error."); } finally { setBusy(false); }
  }}><div className="border-b border-white/10 pb-4"><h2 className="text-lg font-semibold">Registrar nuevo lote</h2><p className="mt-1 text-xs text-white/45">Captura las existencias y su almacén de ingreso.</p></div><div className="grid gap-4 sm:grid-cols-2">
    <Field label="Lote"><input name="name" required className={inputClass} /></Field>
    <Field label={`Cantidad (${component.unit})`}><input name="quantity" type="number" min={component.unit === "pz" ? 1 : 0.000001} step={component.unit === "pz" ? 1 : "0.000001"} required className={inputClass} /></Field>
    <Field label="Caducidad / reanálisis (vacío = No aplica)"><input name="expiry" type="date" className={inputClass} /></Field>
    <Field label="Almacén de ingreso"><select name="destination" className={inputClass}>{WAREHOUSES.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
    <Field label="Origen"><select name="origin" className={inputClass}>{EXTERNAL_LOCATIONS.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
    <Field label="Proveedor"><input name="supplier" className={inputClass} /></Field>
    <Field label="Solicitado por"><input name="requestedBy" className={inputClass} placeholder="Vacío = usuario actual" /></Field>
    <Field label="Recibido por"><input name="receivedBy" className={inputClass} /></Field>
    <Field label="Comentarios / ubicación Otro"><input name="notes" maxLength={1000} className={inputClass} /></Field>
  </div>{error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{error}</p>}<button disabled={busy} className={buttonClass}>{busy ? "Registrando…" : "Crear lote y vale de entrada"}</button></form>;
}
