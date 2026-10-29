"use client";
import { useState } from "react";
import type { Voucher } from "@/lib/inventario/types";
import { voucherDisplayTitle, voucherPrefix } from "@/lib/inventario/voucher-numbering";
import { inventoryRequest } from "@/lib/inventario/service";
import { useInventorySite } from "./InventoryProvider";
import { useWarehouseAccess } from "./useWarehouseAccess";
import { Field, buttonClass, secondaryButtonClass, inputClass, panelClass } from "./InventoryShell";
export function VoucherNumberingBadge({ voucher }: { voucher: Voucher }) {
  if (!voucher.numberingStatus) return null;
  const pending = voucher.numberingStatus === "pending", excluded = voucher.numberingStatus === "excluded";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] ${pending ? "border-amber-300/20 bg-amber-300/5 text-amber-200" : excluded ? "border-white/15 text-white/45" : "border-emerald-300/20 bg-emerald-400/5 text-emerald-200"}`}>{pending ? "ID sugerido · sin confirmar" : excluded ? "Excluido de numeración" : "ID confirmado"}</span>;
}
export default function VoucherTitle({ voucher, onSaved }: { voucher: Voucher; onSaved: (voucher: Voucher) => void }) {
  const { site } = useInventorySite(), { canMove, loading } = useWarehouseAccess();
  const [editing, setEditing] = useState(false), [excluding, setExcluding] = useState(false), [title, setTitle] = useState("");
  const [reason, setReason] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const pending = voucher.numberingStatus === "pending", legacyUntitled = !voucher.numberingStatus && !voucher.title;
  async function save(exclude = false) {
    setBusy(true); setError("");
    try {
      const result = await inventoryRequest<{ voucher: Voucher }>({ action: exclude ? "voucher-numbering-exclude" : "voucher-title", voucherId: voucher.id, title: editing ? title : voucher.suggestedTitle, expectedTitle: voucher.title || "", expectedSuggestion: voucher.suggestedTitle || "", reason, site });
      onSaved(result.voucher); setEditing(false); setExcluding(false); setReason("");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  }
  return <section className={`${panelClass} print-hide space-y-4`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-white/45">Identificación del vale · {site}</p><h2 className="mt-1 break-words text-xl font-semibold">{voucherDisplayTitle(voucher)}</h2></div><VoucherNumberingBadge voucher={voucher} /></div>
    <p className="text-sm leading-relaxed text-white/55">{pending ? "Sugerencia según el orden de creación de los vales de esta semana. El almacenista debe revisar y confirmar el ID; todavía no es definitivo." : voucher.numberingStatus === "excluded" ? "Este registro no ocupa un ID semanal. Su movimiento y sus existencias se conservan." : legacyUntitled ? "Vale histórico sin ID. El almacenista puede registrar su identificación." : "ID registrado. Se conserva para mantener la trazabilidad del vale."}</p>
    {voucher.numberingExcludedSuggestion && <p className="text-xs text-white/40">Sugerencia descartada: {voucher.numberingExcludedSuggestion}</p>}
    {voucher.numberingExclusionReason && <p className="break-words rounded-xl border border-white/10 p-3 text-sm text-white/65">Motivo de exclusión: {voucher.numberingExclusionReason}</p>}
    {voucher.titleConfirmedAt && <p className="text-xs text-white/40">Confirmado el {new Date(voucher.titleConfirmedAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}</p>}
    {error && <div role="alert" className="space-y-2 rounded-xl border border-red-300/20 p-3"><p className="text-sm text-red-200">{error}</p><button type="button" disabled={busy} className={secondaryButtonClass} onClick={async () => { setBusy(true); try { const result = await inventoryRequest<{ voucher: Voucher }>(undefined, `voucherId=${voucher.id}`, site); onSaved(result.voucher); setError(""); setEditing(false); setExcluding(false); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo actualizar."); } finally { setBusy(false); } }}>Actualizar sugerencia</button></div>}
    {canMove && (pending || legacyUntitled) && !excluding && <>
      {editing ? <form className="space-y-3" onSubmit={e => { e.preventDefault(); void save(); }}><Field label="ID que confirmará el almacenista"><input autoFocus disabled={busy} required maxLength={120} className={inputClass} value={title} onChange={e => setTitle(e.target.value)} placeholder={voucher.suggestedTitle || voucherPrefix(site, voucher.createdAt) + "A"} /></Field><p className="text-xs text-white/45">Debe corresponder a la semana de creación y no estar ocupado por otro vale.</p><div className="flex flex-col gap-2 sm:flex-row"><button disabled={busy} className={buttonClass}>{busy ? "Guardando…" : "Confirmar ID"}</button><button type="button" disabled={busy} className={secondaryButtonClass} onClick={() => setEditing(false)}>Cancelar</button></div></form>
      : <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{pending && <button type="button" disabled={busy || !voucher.suggestedTitle} className={buttonClass} onClick={() => void save()}>{busy ? "Confirmando…" : "Confirmar ID sugerido"}</button>}<button type="button" disabled={busy} className={secondaryButtonClass} onClick={() => { setTitle(voucher.suggestedTitle || voucherPrefix(site, voucher.createdAt)); setEditing(true); setError(""); }}>{pending ? "Corregir antes de confirmar" : "Registrar ID"}</button>{pending && <button type="button" disabled={busy} className={secondaryButtonClass} onClick={() => { setExcluding(true); setError(""); }}>Excluir de numeración</button>}</div>}
    </>}
    {canMove && pending && excluding && <form className="space-y-3 rounded-xl border border-amber-300/20 p-4" onSubmit={e => { e.preventDefault(); void save(true); }}><h3 className="font-medium">Excluir este vale de la numeración</h3><p className="text-sm leading-relaxed text-white/60">Libera su sugerencia y recalcula los IDs pendientes. No borra el historial ni devuelve o descuenta material. Los IDs confirmados se conservan.</p><Field label="Motivo"><textarea required maxLength={1000} disabled={busy} className={inputClass} value={reason} onChange={e => setReason(e.target.value)} /></Field><div className="flex flex-col gap-2 sm:flex-row"><button disabled={busy} className={buttonClass}>{busy ? "Guardando…" : "Confirmar exclusión"}</button><button type="button" disabled={busy} className={secondaryButtonClass} onClick={() => setExcluding(false)}>Cancelar</button></div></form>}
    {!loading && !canMove && pending && <p className="text-xs text-white/45">Pendiente de confirmación por un almacenista de {site}.</p>}
  </section>;
}
