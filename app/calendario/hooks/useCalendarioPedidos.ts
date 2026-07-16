"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/src/firebase/firebaseConfig";
import type { Pedido } from "../types";

export function useCalendarioPedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
const [cargandoEjecuciones, setCargandoEjecuciones] =
  useState(false);
  const cargarPedidos = useCallback(async () => {
    try {
      setCargando(true);
      setError("");

      const usuariosSnap = await getDocs(collection(db, "users"));

      const nameByEmail: Record<string, string> = {};

      usuariosSnap.forEach((usuarioDoc) => {
        const data = usuarioDoc.data() as Record<string, unknown>;
        const email = String(data.email || "");

        if (!email) return;

        const nombreCompleto =
          [data.nombre, data.apellido]
            .filter(Boolean)
            .map(String)
            .join(" ") || email;

        nameByEmail[email] = nombreCompleto;
      });

      const pedidosQuery = query(
        collection(db, "pedidos"),
        orderBy("timestamp", "desc")
      );

      const pedidosSnap = await getDocs(pedidosQuery);
      const pedidosData: Pedido[] = [];

      for (const pedidoDoc of pedidosSnap.docs) {
        const data = pedidoDoc.data() as Record<string, any>;
        const correo = data.correoUsuario || data.usuario || "";

        const pedidoBase: Pedido = {
          id: pedidoDoc.id,
          pedidoId: pedidoDoc.id,
          titulo: data.titulo || "Sin título",
          proyecto: data.proyecto || "Sin proyecto",
          fechaEntregaReal: data.fechaEntregaReal || "",
          fechaLimite: data.fechaLimite || "",
          costo: data.costo || "",
          nombreCosto: data.nombreCosto || "",
          status: data.status || "enviado",
          correoUsuario: correo,
          nombreUsuario:
            data.nombreUsuario ||
            nameByEmail[correo] ||
            correo ||
            "Sin información",
        };

        pedidosData.push(pedidoBase);

        try {
          const ejecucionesQuery = query(
            collection(db, "pedidos", pedidoDoc.id, "ejecuciones"),
            orderBy("numero", "asc")
          );

          const ejecucionesSnap = await getDocs(ejecucionesQuery);

          ejecucionesSnap.forEach((ejecucionDoc) => {
            const ejecucion = ejecucionDoc.data() as Record<string, any>;
            const correoEjecucion = ejecucion.solicitadoPorEmail || "";

            pedidosData.push({
              id: `${pedidoDoc.id}__${ejecucionDoc.id}`,
              pedidoId: pedidoDoc.id,
              ejecucionId: ejecucionDoc.id,
              esEjecucion: true,

              titulo:
                ejecucion.titulo ||
                `${data.titulo || "Sin título"} (${ejecucion.numero || ""})`,

              proyecto: data.proyecto || "Sin proyecto",
              fechaLimite: ejecucion.fechaLimite || "",
              fechaEntregaReal: ejecucion.fechaEntregaReal || "",
              costo: ejecucion.costo || "",
              nombreCosto: ejecucion.nombreCosto || "",
              status: ejecucion.status || "en proceso",
              correoUsuario: correoEjecucion,
              nombreUsuario:
                ejecucion.solicitadoPorNombre ||
                nameByEmail[correoEjecucion] ||
                correoEjecucion ||
                "Sin información",
            });
          });
        } catch (executionError) {
          console.error(
            `No se pudieron cargar las ejecuciones de ${pedidoDoc.id}:`,
            executionError
          );
        }
      }

      setPedidos(pedidosData);
    } catch (loadError) {
      console.error("Error al cargar el calendario:", loadError);
      setError("No fue posible cargar los pedidos del calendario.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarPedidos();
  }, [cargarPedidos]);

  const actualizarCampo = useCallback(
    async (pedido: Pedido, campo: string, valor: string) => {
      try {
        const documentRef = pedido.ejecucionId
          ? doc(
              db,
              "pedidos",
              pedido.pedidoId,
              "ejecuciones",
              pedido.ejecucionId
            )
          : doc(db, "pedidos", pedido.pedidoId);

        await updateDoc(documentRef, {
          [campo]: valor,
        });

        setPedidos((current) =>
          current.map((item) =>
            item.id === pedido.id
              ? {
                  ...item,
                  [campo]: valor,
                }
              : item
          )
        );
      } catch (updateError) {
        console.error("Error al actualizar el pedido:", updateError);
        throw updateError;
      }
    },
    []
  );

 return {
  pedidos,
  cargando,
  cargandoEjecuciones,
  error,
  actualizarCampo,
  recargar: cargarPedidos,
};
}