"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/src/firebase/firebaseConfig";
import { inventoryRequest } from "@/lib/inventario/service";
import { inventoryHref, voucherDestination } from "@/lib/inventario/sites";
import { locationName } from "@/lib/inventario/catalogs";
import type { VoucherLine, MovementKind } from "@/lib/inventario/types";
import { useInventorySite } from "./InventoryProvider";
import { panelClass, buttonClass, secondaryButtonClass } from "./InventoryShell";
type Request = { id: string; status: string; kind: MovementKind; project: string; notes: string; requestedBy: string; createdAt: string; lines: (VoucherLine & { origin: string; destination: string })[]; voucherIds: string[] };
export default function InventoryMovementRequests() {
  const { site } = useInventorySite(), router = useRouter(), params = useSearchParams();
  const [requests, setRequests] = useState<Request[]>([]), [canFulfill, setCanFulfill] = useState(false);
  const [selectedId, setSelectedId] = useState(params.get("movementRequest") || "");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { setSelectedId(params.get("movementRequest") || ""); }, [params]);
  useEffect(() => {
    let active = true;
    async function reload() {
      if (!auth.currentUser) return;
      try { const result = await inventoryRequest<{ requests: Request[]; canFulfill: boolean }>(undefined, "view=movement-requests", site); if (active) { setRequests(result.requests); setCanFulfill(result.canFulfill); setError(""); } }
      catch (e) { if (active) setError(e instanceof Error ? e.message : "No se pudieron cargar las solicitudes."); }
      finally { if (active) setLoading(false); }
    }
    const unsubscribe = onAuthStateChanged(auth, user => { if (user) void reload(); else { setRequests([]); setCanFulfill(false); setLoading(false); } });
    const focus = () => { void reload(); }; window.addEventListener("focus", focus);
    return () => { active = false; unsubscribe(); window.removeEventListener("focus", focus); };
  }, [site]);
  const selected = requests.find(request => request.id === selectedId);
  return <section className="space-y-4"><div><h2 className="text-2xl font-semibold">Solicitudes desde inventario</h2><p className="mt-2 text-sm text-white/55">El almacenista revisa los lotes y cantidades antes de confirmar. Enviar una solicitud no aparta ni descuenta material.</p></div>
    {error && <p role="alert" className="rounded-xl border border-red-400/20 p-3 text-sm text-red-200">{error}</p>}
    {loading ? <p className="text-sm text-white/50">Cargando solicitudes…</p> : !requests.length ? <p className={panelClass}>No hay solicitudes de inventario.</p> : <div className="grid gap-3 sm:grid-cols-2">{requests.map(request => <button type="button" disabled={busy} key={request.id} onClick={() => { setSelectedId(request.id); setError(""); }} className={`${panelClass} text-left ${selectedId === request.id ? "border-emerald-300/30 bg-emerald-400/5" : ""}`}><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">Solicitud · {request.id.slice(-8)}</strong><span className="text-xs text-emerald-200">{request.status === "fulfilled" ? "Atendida" : "Pendiente"}</span></div><p className="mt-2 text-sm">{request.requestedBy} · {request.project}</p><p className="mt-2 text-xs text-white/50">{request.lines.length} partidas · {new Date(request.createdAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}</p></button>)}</div>}
    {selected && <section className={`${panelClass} space-y-4`}><h3 className="text-lg font-semibold">Solicitud · {selected.id.slice(-8)}</h3><p className="text-sm text-white/55">{selected.requestedBy} · {selected.project} · {selected.kind === "salida" ? "Retiro / salida" : selected.kind === "entrada" ? "Entrada / devolución" : "Traslado"}</p>{selected.lines.map((line, index) => <div key={index} className="space-y-2 border-t border-white/10 pt-4"><p className="break-words font-medium">{line.code} · {line.name}</p><p className="text-sm text-emerald-200">Lote {line.lot} · {line.quantity} {line.unit}</p><p className="text-xs text-white/55">{locationName(line.origin)} → {locationName(line.destination)} · Caducidad: {line.expiry || "No aplica"}</p></div>)}{selected.notes && <p className="whitespace-pre-wrap text-sm text-white/60">{selected.notes}</p>}
    {selected.voucherIds.map(id => <Link key={id} className={secondaryButtonClass} href={inventoryHref(`/inventario/vales/${id}`, site)}>Abrir vale · {id.slice(-8)}</Link>)}
    {selected.status === "pending" && (canFulfill ? <button type="button" disabled={busy} className={buttonClass} onClick={async () => { setBusy(true); setError(""); try { const result = await inventoryRequest<{ voucherIds: string[] }>({ action: "fulfill-movement-request", requestId: selected.id, site }); router.push(voucherDestination(result.voucherIds, site)); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo atender."); } finally { setBusy(false); } }}>{busy ? "Confirmando…" : "Confirmar movimiento y generar vale"}</button> : <p className="text-sm text-white/55">Solicitud enviada. Pendiente de atención por el almacenista.</p>)}</section>}
  </section>;
}
