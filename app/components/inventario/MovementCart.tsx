"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { WAREHOUSES, EXTERNAL_LOCATIONS, locationName } from "@/lib/inventario/catalogs";
import { selectLot, mexicoToday } from "@/lib/inventario/selection";
import { inventoryRequest } from "@/lib/inventario/service";
import type { CartLine, InventoryComponent, MovementKind } from "@/lib/inventario/types";
import { buttonClass, inputClass, panelClass, Field } from "./InventoryShell";
import QrScanner from "./QrScanner";
export default function MovementCart({ components, initialId = "", onSaved }: { components: InventoryComponent[]; initialId?: string; onSaved: () => void }) {
  const [kind, setKind] = useState<MovementKind>("salida"), [componentId, setComponentId] = useState(initialId), [quantity, setQuantity] = useState("");
  const [origin, setOrigin] = useState(""), [destination, setDestination] = useState("externo:produccion"), [lotId, setLotId] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState(""), [voucherIds, setVoucherIds] = useState<string[]>([]);
  const pending = useRef<{ signature: string; id: string } | null>(null);
  const c = components.find(x => x.id === componentId);
  const origins = kind === "entrada" ? EXTERNAL_LOCATIONS : WAREHOUSES.filter(w => (kind !== "salida" || w.usable) && c?.lots.some(l => (l.stock[w.id] || 0) > 0));
  const actualOrigin = origins.some(w => w.id === origin) ? origin : origins[0]?.id || "";
  const destinations = kind === "salida" ? EXTERNAL_LOCATIONS : WAREHOUSES;
  const actualDestination = destinations.some(w => w.id === destination) ? destination : destinations[0]?.id || "";
  function predicted(line: CartLine, prior: CartLine[]) {
    const article = components.find(x => x.id === line.componentId); if (!article) return;
    const lots = JSON.parse(JSON.stringify(article.lots)) as InventoryComponent["lots"];
    for (const p of prior.filter(x => x.componentId === line.componentId)) {
      const chosen = kind === "salida" ? selectLot(lots, p.origin, p.quantity, mexicoToday()) : lots.find(l => l.id === p.lotId);
      if (chosen && kind !== "entrada") chosen.stock[p.origin] = (chosen.stock[p.origin] || 0) - p.quantity;
    }
    return kind === "salida" ? selectLot(lots, line.origin, line.quantity, mexicoToday()) : lots.find(l => l.id === line.lotId);
  }
  return <section className={`${panelClass} space-y-4`}><h2 className="text-xl font-semibold">Registrar movimiento</h2>
    <Field label="Tipo de movimiento"><select disabled={busy || lines.length > 0} className={inputClass} value={kind} onChange={e => { setKind(e.target.value as MovementKind); setOrigin(""); setLotId(""); }}>{["salida", "entrada", "traslado"].map(k => <option key={k} value={k}>{k === "entrada" ? "Entrada / devolución" : k === "traslado" ? "Traslado entre almacenes" : "Retiro / salida"}</option>)}</select></Field>
    <QrScanner onScan={id => { if (components.some(x => x.id === id)) { setComponentId(id); setOrigin(""); setLotId(""); } else setError("El componente no existe."); }} />
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Artículo"><select disabled={busy} className={inputClass} value={componentId} onChange={e => { setComponentId(e.target.value); setOrigin(""); setLotId(""); }}><option value="">Selecciona un artículo</option>{components.map(x => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></Field>
    <Field label={`Cantidad ${c ? `(${c.unit})` : ""}`}><input disabled={busy} className={inputClass} type="number" min="0.000001" step={c?.unit === "pz" ? 1 : "0.000001"} value={quantity} onChange={e => setQuantity(e.target.value)} /></Field>
    <Field label={origins.length === 1 ? "Origen identificado" : "Origen · ubicaciones disponibles"}><select disabled={busy || origins.length === 1} className={inputClass} value={actualOrigin} onChange={e => setOrigin(e.target.value)}>{!origins.length && <option value="">Sin existencias habilitadas</option>}{origins.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
    <Field label="Destino"><select disabled={busy} className={inputClass} value={actualDestination} onChange={e => setDestination(e.target.value)}>{destinations.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
    {kind !== "salida" && <Field label="Lote al que pertenecen las piezas"><select disabled={busy} className={inputClass} value={lotId} onChange={e => setLotId(e.target.value)}><option value="">Seleccionar lote</option>{c?.lots.map(l => <option key={l.id} value={l.id}>{l.name} · {l.stock[actualOrigin] || 0} en origen · {l.expiry || "Sin caducidad"}</option>)}</select></Field>}</div>
    <button type="button" disabled={busy} className={buttonClass} onClick={() => {
      setError(""); const q = Number(quantity); if (!c || !Number.isFinite(q) || q <= 0 || !actualOrigin || (c.unit === "pz" && !Number.isInteger(q))) { setError("Selecciona artículo, origen y una cantidad válida."); return; }
      if (actualOrigin === actualDestination) { setError("Origen y destino deben ser diferentes."); return; }
      const line = { componentId, quantity: q, origin: actualOrigin, destination: actualDestination, ...(kind !== "salida" ? { lotId } : {}) };
      const chosen = predicted(line, lines); if (!chosen || (kind !== "entrada" && (chosen.stock[actualOrigin] || 0) < q)) { setError("Ningún lote tiene la cantidad suficiente para este movimiento y los artículos ya agregados. No se combinaron lotes."); return; }
      if (lines.length >= 50) { setError("Máximo 50 artículos por movimiento."); return; }
      setLines([...lines, line]); setQuantity(""); setVoucherIds([]);
    }}>Agregar al carrito</button>
    {lines.length > 0 && <><div className="space-y-2">{lines.map((line, i) => { const article = components.find(x => x.id === line.componentId); const lot = predicted(line, lines.slice(0, i)); return <div key={i} className="rounded-xl border border-white/15 p-3"><strong>{article?.code} · {line.quantity} {article?.unit}</strong><p className="text-sm text-white/70">Lote: {lot?.name || "Sin lote suficiente"} · {locationName(line.origin)} → {locationName(line.destination)}</p><button disabled={busy} onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-sm text-red-300">Quitar</button></div>; })}</div>
    <form className="space-y-3" onSubmit={async e => {
      e.preventDefault(); const form = e.currentTarget; const meta = Object.fromEntries(new FormData(form)); const body = { action: "movement", kind, lines, ...meta }; const signature = JSON.stringify(body);
      if (!pending.current || pending.current.signature !== signature) pending.current = { signature, id: crypto.randomUUID() }; setBusy(true); setError("");
      try { const r = await inventoryRequest<{ voucherIds: string[] }>({ ...body, operationId: pending.current.id }); pending.current = null; setLines([]); setVoucherIds(r.voucherIds); onSaved(); } catch (err) { setError(err instanceof Error ? err.message : "No se pudo registrar."); } finally { setBusy(false); }
    }}><div className="grid gap-3 sm:grid-cols-2"><Field label="Proyecto / proceso del vale"><input disabled={busy} name="project" className={inputClass} /></Field><Field label="Solicitado por"><input disabled={busy} name="requestedBy" className={inputClass} placeholder="Vacío = usuario actual" /></Field><Field label="Recibido por"><input disabled={busy} name="receivedBy" className={inputClass} /></Field><Field label="Comentarios / ubicación Otro"><input disabled={busy} name="notes" className={inputClass} maxLength={1000} /></Field></div><p className="text-sm text-white/60">Al confirmar se actualizarán existencias y se generará un vale por origen y destino. El servidor volverá a comprobar la disponibilidad del lote.</p><button disabled={busy} className={buttonClass}>{busy ? "Registrando…" : "Confirmar movimiento y generar vales"}</button></form></>}
    {error && <p role="alert" className="text-red-300">{error}</p>}{voucherIds.length > 0 && <div role="status" className="space-y-2 text-emerald-300"><p>Movimiento registrado.</p>{voucherIds.map(id => <Link className="block underline" key={id} href={`/inventario/vales/${id}`}>Abrir vale para imprimir · {id.slice(-8)}</Link>)}</div>}
  </section>;
}
