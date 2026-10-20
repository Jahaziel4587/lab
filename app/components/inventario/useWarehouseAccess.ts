"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/src/firebase/firebaseConfig";
import { inventoryRequest } from "@/lib/inventario/service";
import { useInventorySite } from "./InventoryProvider";
type Access = { canMove: boolean; canDeleteEmptyLots: boolean };
export function useWarehouseAccess() {
  const { site } = useInventorySite();
  const [access, setAccess] = useState<Access>({ canMove: false, canDeleteEmptyLots: false });
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => {
    let active = true; setLoading(true);
    const unsubscribe = onAuthStateChanged(auth, user => {
      setAccess({ canMove: false, canDeleteEmptyLots: false });
      if (!user) { if (active) setLoading(false); return; }
      inventoryRequest<Access>(undefined, "view=permissions", site).then(value => { if (active) { setAccess(value); setError(""); } }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    });
    return () => { active = false; unsubscribe(); };
  }, [site]);
  return { ...access, loading, error };
}
