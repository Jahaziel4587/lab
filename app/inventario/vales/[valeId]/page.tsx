"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/src/firebase/firebaseConfig";
import { inventoryRequest } from "@/lib/inventario/service";
import type { Voucher } from "@/lib/inventario/types";
import InventoryShell from "@/app/components/inventario/InventoryShell";
import MaterialVoucher from "@/app/components/inventario/MaterialVoucher";
export default function VoucherPage() {
  const { valeId } = useParams<{ valeId: string }>(); const router = useRouter();
  const [v, setV] = useState<Voucher | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => { let live = true; const unsub = onAuthStateChanged(auth, user => {
    if (!user) { setV(null); router.replace("/login"); return; }
    inventoryRequest<{ voucher: Voucher }>(undefined, `?voucherId=${encodeURIComponent(valeId)}`).then(r => { if (live) setV(r.voucher); }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
  }); return () => { live = false; unsub(); }; }, [valeId, router]);
  return <InventoryShell>{error ? <p role="alert">{error}</p> : loading ? <p>Cargando vale…</p> : v ? <MaterialVoucher voucher={v} /> : <p>Vale no encontrado en los registros recientes.</p>}</InventoryShell>;
}
