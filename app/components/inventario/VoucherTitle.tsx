"use client";
import { useState } from "react";
import type { Voucher } from "@/lib/inventario/types";
import { inventoryRequest } from "@/lib/inventario/service";
import { useInventorySite } from "./InventoryProvider";
import { Field, buttonClass, secondaryButtonClass, inputClass, panelClass } from "./InventoryShell";
export default function VoucherTitle({ voucher, onSaved }: { voucher: Voucher; onSaved: (title: string) => void }) {
  const { site } = useInventorySite();
  const [editing, setEditing] = useState(false), [title, setTitle] = useState(voucher.title || "");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <section className={`${panelClass} print-hide space-y-3`}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="break-words text-lg font-semibold">{voucher.title || `Vale · ${voucher.id.slice(-8)}`}</h2><p className="mt-1 text-xs text-white/50">Registra aquí el ID del vale impreso y firmado para que los demás almacenistas puedan identificarlo.</p></div>{!editing && <button type="button" className={secondaryButtonClass} onClick={() => { setTitle(voucher.title || ""); setError(""); setEditing(true); }}>Editar título</button>}</div>{editing && <form className="space-y-3" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try { const result = await inventoryRequest<{ title: string }>({ action: "voucher-title", voucherId: voucher.id, title, expectedTitle: voucher.title || "", site }); onSaved(result.title); setEditing(false); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar el título."); } finally { setBusy(false); } }}><Field label="Título / ID del vale"><input autoFocus disabled={busy} maxLength={120} className={inputClass} value={title} onChange={e => setTitle(e.target.value)} placeholder="ID del documento impreso" /></Field><p className="text-xs text-white/45">Vacío restaura el título original. El folio interno y los movimientos se conservan.</p>{error && <p role="alert" className="text-sm text-red-200">{error}</p>}<div className="flex flex-wrap gap-2"><button disabled={busy} className={buttonClass}>{busy ? "Guardando…" : "Guardar título"}</button><button type="button" disabled={busy} className={secondaryButtonClass} onClick={() => setEditing(false)}>Cancelar</button></div></form>}</section>;
}
