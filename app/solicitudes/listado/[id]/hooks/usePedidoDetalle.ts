import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/src/firebase/firebaseConfig";

export function usePedidoDetalle(id?: string) {
  const [pedido, setPedido] = useState<any>(null);
  const [loadingPedido, setLoadingPedido] = useState(true);

  useEffect(() => {
    if (!id) return;

    const cargarPedido = async () => {
      try {
        setLoadingPedido(true);
        const ref = doc(db, "pedidos", id);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setPedido(snap.data());
        } else {
          setPedido(null);
        }
      } catch (err) {
        console.error("Error al cargar pedido:", err);
        setPedido(null);
      } finally {
        setLoadingPedido(false);
      }
    };

    cargarPedido();
  }, [id]);

  return {
    pedido,
    setPedido,
    loadingPedido,
  };
}