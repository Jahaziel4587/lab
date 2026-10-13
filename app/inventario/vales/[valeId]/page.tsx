"use client";
import { useInventorySite } from "@/app/components/inventario/InventoryProvider";
import Link from "next/link";
import { inventoryHref } from "@/lib/inventario/sites";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/src/firebase/firebaseConfig";
import { inventoryRequest } from "@/lib/inventario/service";
import type { Voucher } from "@/lib/inventario/types";
import InventoryShell from "@/app/components/inventario/InventoryShell";
import MaterialVoucher from "@/app/components/inventario/MaterialVoucher";
export default function VoucherPage() {
  const search = useSearchParams();
  const related = (search.get("related") || "").split(",").filter(id => /^[a-zA-Z0-9]{10,100}$/.test(id)).slice(0,50);
  const { site } = useInventorySite();
  const { valeId } = useParams<{ valeId: string }>(); const router = useRouter();
  const [v, setV] = useState<Voucher | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => { let live = true; const unsub = onAuthStateChanged(auth, user => {
    if (!user) { setV(null); router.replace("/login"); return; }
    inventoryRequest<{ voucher: Voucher }>(undefined, `?voucherId=${encodeURIComponent(valeId)}`, site).then(r => { if (live) setV(r.voucher); }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
  }); return () => { live = false; unsub(); }; }, [valeId, router, site]);
  return <InventoryShell>{error ? <p role="alert">{error}</p> : loading ? <p>Cargando vale…</p> : v ? <>{related.length > 1 && <div className="flex flex-wrap gap-2">{related.map((id,i)=><Link key={id} className="rounded-xl border border-white/10 px-3 py-2 text-emerald-300" href={inventoryHref(`/inventario/vales/${id}`,site)+`&related=${encodeURIComponent(related.join(","))}`}>Vale {i+1} de {related.length}</Link>)}</div>}<MaterialVoucher voucher={v} /></> : <p>Vale no encontrado en los registros recientes.</p>}</InventoryShell>;
}
