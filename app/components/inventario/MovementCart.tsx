"use client";
import { useInventorySite } from "@/app/components/inventario/InventoryProvider";
import { inventoryHref } from "@/lib/inventario/sites";
import Link from "next/link";
import { useRef, useState } from "react";
import { WAREHOUSES, EXTERNAL_LOCATIONS } from "@/lib/inventario/catalogs";
import { selectLot, mexicoToday } from "@/lib/inventario/selection";
import { inventoryRequest } from "@/lib/inventario/service";
import type { InventoryComponent, MovementKind } from "@/lib/inventario/types";
import { buttonClass, inputClass, panelClass, Field } from "./InventoryShell";
import QrScanner from "./QrScanner";
export default function MovementCart({ components, initialId = "", fixedLotId = "", onSaved }: { components: InventoryComponent[]; initialId?: string; fixedLotId?: string; onSaved: () => void }) {
  const { site } = useInventorySite();
  const [kind, setKind] = useState<MovementKind>("salida"), [componentId, setComponentId] = useState(initialId), [quantity, setQuantity] = useState("");
  const [origin, setOrigin] = useState(""), [destination, setDestination] = useState("externo:produccion"), [lotId, setLotId] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [voucherIds, setVoucherIds] = useState<string[]>([]);
  const pending = useRef<{ signature: string; id: string } | null>(null);
  const c = components.find(x => x.id === componentId);
  const selectedLot = c?.lots.find(l => l.id === fixedLotId);
  const origins = kind === "entrada" ? EXTERNAL_LOCATIONS : WAREHOUSES.filter(w => (kind !== "salida" || w.usable) && (fixedLotId ? (selectedLot?.stock[w.id] || 0) > 0 : c?.lots.some(l => (l.stock[w.id] || 0) > 0)));
  const actualOrigin = origins.some(w => w.id === origin) ? origin : origins[0]?.id || "";
  const destinations = kind === "salida" ? EXTERNAL_LOCATIONS : WAREHOUSES;
  const actualDestination = destinations.some(w => w.id === destination) ? destination : destinations[0]?.id || "";
  return <section className={`${panelClass} space-y-5`}><div className="border-b border-white/10 pb-4"><h2 className="text-lg font-semibold">Registrar movimiento</h2><p className="mt-1 text-xs text-white/45">{fixedLotId ? `${c?.code} · Lote ${selectedLot?.name}` : "Selecciona el artículo y la cantidad que vas a mover."}</p></div>
    <Field label="Tipo de movimiento"><select disabled={busy} className={inputClass} value={kind} onChange={e => { setKind(e.target.value as MovementKind); setOrigin(""); setLotId(""); }}>{["salida", "entrada", "traslado"].map(k => <option key={k} value={k}>{k === "entrada" ? "Entrada / devolución" : k === "traslado" ? "Traslado entre almacenes" : "Retiro / salida"}</option>)}</select></Field>
    {!fixedLotId && <QrScanner onScan={(id, scannedSite) => { if ((scannedSite || "B1") !== site) { setError("Este QR pertenece a otro almacén. Selecciona el almacén correspondiente."); return; } if (components.some(x => x.id === id)) { setComponentId(id); setOrigin(""); setLotId(""); } else setError("El componente no existe."); }} />}
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Artículo"><select disabled={busy || !!fixedLotId} className={inputClass} value={componentId} onChange={e => { setComponentId(e.target.value); setOrigin(""); setLotId(""); }}><option value="">Selecciona un artículo</option>{components.map(x => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></Field>
    <Field label={`Cantidad ${c ? `(${c.unit})` : ""}`}><input disabled={busy} className={inputClass} type="number" min="0.000001" step={c?.unit === "pz" ? 1 : "0.000001"} value={quantity} onChange={e => setQuantity(e.target.value)} /></Field>
    <Field label={origins.length === 1 ? "Origen identificado" : "Origen · ubicaciones disponibles"}><select disabled={busy || origins.length === 1} className={inputClass} value={actualOrigin} onChange={e => setOrigin(e.target.value)}>{!origins.length && <option value="">Sin existencias habilitadas</option>}{origins.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
    <Field label="Destino"><select disabled={busy} className={inputClass} value={actualDestination} onChange={e => setDestination(e.target.value)}>{destinations.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
    {kind !== "salida" && !fixedLotId && <Field label="Lote al que pertenecen las piezas"><select disabled={busy} className={inputClass} value={lotId} onChange={e => setLotId(e.target.value)}><option value="">Seleccionar lote</option>{c?.lots.map(l => <option key={l.id} value={l.id}>{l.name} · {l.stock[actualOrigin] || 0} en origen · {l.expiry || "Sin caducidad"}</option>)}</select></Field>}</div>
    <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); setError("");
      const q = Number(quantity);
      if (!c || !Number.isFinite(q) || q <= 0 || !actualOrigin || (c.unit === "pz" && !Number.isInteger(q))) { setError("Selecciona artículo, origen y una cantidad válida."); return; }
      if (actualOrigin === actualDestination) { setError("Origen y destino deben ser diferentes."); return; }
      const chosenId = fixedLotId || lotId;
      const chosen = kind === "salida" ? selectLot(c.lots, actualOrigin, q, mexicoToday(), chosenId || undefined) : c.lots.find(l => l.id === chosenId);
      if (!chosen || (kind !== "entrada" && (chosen.stock[actualOrigin] || 0) < q)) { setError("El lote no está disponible o no tiene existencias suficientes. Los retiros requieren un lote vigente."); return; }
      const meta = Object.fromEntries(new FormData(e.currentTarget));
      const line = { componentId, quantity: q, origin: actualOrigin, destination: actualDestination, lotId: chosen.id };
      const body = { action: "movement", kind, lines: [line], ...meta, requestedBy: "", receivedBy: "" };
      const signature = JSON.stringify(body);
      if (!pending.current || pending.current.signature !== signature) pending.current = { signature, id: crypto.randomUUID() };
      setBusy(true);
      try { const r = await inventoryRequest<{ voucherIds: string[] }>({ ...body, operationId: pending.current.id, site }); pending.current = null; setQuantity(""); setVoucherIds(r.voucherIds); onSaved(); }
      catch (err) { setError(err instanceof Error ? err.message : "No se pudo registrar."); }
      finally { setBusy(false); }
    }}>
      <Field label="Proyecto / proceso del vale"><input disabled={busy} name="project" className={inputClass} /></Field>
      <p className="text-xs text-white/50">Solicitado por y recibido por se llenan a mano en el vale impreso.</p>
      <Field label="Comentarios del vale (opcional)"><input disabled={busy} name="notes" className={inputClass} maxLength={1000} /><span className="block text-xs text-white/40">Se imprimen en la columna Comentarios de la tabla de artículos.</span></Field>
      {actualOrigin === "externo:otro" && <Field label="Especificar origen Otro"><input disabled={busy} required name="originOther" className={inputClass} maxLength={200} /><span className="block text-xs text-white/40">Se imprime junto a la casilla Otro de Origen.</span></Field>}
      {actualDestination === "externo:otro" && <Field label="Especificar destino Otro"><input disabled={busy} required name="destinationOther" className={inputClass} maxLength={200} /><span className="block text-xs text-white/40">Se imprime junto a la casilla Otro de Destino.</span></Field>}
      <p className="text-sm text-white/60">Al confirmar se actualizarán las existencias y se generará el vale de material.</p>
      <button disabled={busy} className={buttonClass}>{busy ? "Registrando…" : "Confirmar movimiento y generar vale"}</button>
    </form>
    {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{error}</p>}{voucherIds.length > 0 && <div role="status" className="space-y-2 text-emerald-300"><p>Movimiento registrado.</p>{voucherIds.map(id => <Link className="block underline" key={id} href={inventoryHref(`/inventario/vales/${id}`, site)}>Abrir vale para imprimir · {id.slice(-8)}</Link>)}</div>}
  </section>;
}
