"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { inventoryRequest } from "@/lib/inventario/service";
import { inventoryHref } from "@/lib/inventario/sites";
import type { Voucher } from "@/lib/inventario/types";
import { locationName } from "@/lib/inventario/catalogs";
import { useInventorySite } from "./InventoryProvider";
import { panelClass } from "./InventoryShell";

export default function ComponentHistory({ componentId, revision }: { componentId: string; revision: number }) {
  const { site } = useInventorySite();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => {
    let live = true; setLoading(true); setError(""); setVouchers([]);
    inventoryRequest<{ vouchers: Voucher[] }>(undefined, `historyComponent=${encodeURIComponent(componentId)}`, site)
      .then(data => { if (live) setVouchers(data.vouchers); })
      .catch(e => { if (live) setError(e instanceof Error ? e.message : "No se pudo cargar el historial."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [componentId, site, revision]);
  return <section className={`${panelClass} space-y-4`}>
    <div><h2 className="text-lg font-semibold">Historial de movimientos</h2><p className="mt-1 text-xs text-white/45">Vales de material que incluyen este componente.</p></div>
    {loading ? <p className="text-sm text-white/50">Cargando historial…</p> : error ? <p role="alert" className="text-sm text-red-300">{error}</p> : !vouchers.length ? <p className="py-6 text-center text-sm text-white/45">Todavía no hay movimientos registrados.</p> : vouchers.map(v => <Link key={v.id} href={inventoryHref(`/inventario/vales/${v.id}`, site)} className="block space-y-2 rounded-2xl border border-white/10 bg-white/[0.035] p-4 hover:bg-white/[0.06]">
      <div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">Vale · {v.id.slice(-8)}</strong><span className="text-xs text-emerald-300">{v.kind === "entrada" ? "Entrada / devolución" : v.kind === "salida" ? "Retiro / salida" : "Traslado"}</span></div>
      <p className="text-xs text-white/50">{new Date(v.createdAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })} · {locationName(v.origin)} → {locationName(v.destination)}</p>
      <p className="text-sm text-white/75">{v.lines.filter(l => l.componentId === componentId).map(l => `${l.lot}: ${l.quantity} ${l.unit}`).join(" · ")}</p>
      <p className="text-xs text-emerald-200">Ver vale de material →</p>
    </Link>)}
  </section>;
}
