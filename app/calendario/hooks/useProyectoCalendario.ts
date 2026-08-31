"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {  auth,db } from "@/src/firebase/firebaseConfig";
import type { Pedido, Usuario } from "../types";

export function useProyectoCalendario(
  proyecto: string,
  isAdmin: boolean,
  enabled: boolean,
) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(
    new Set()
  );

  const [cargando, setCargando] = useState(true);
  const [cargandoShare, setCargandoShare] = useState(true);
  const [guardandoShare, setGuardandoShare] = useState(false);
  const [error, setError] = useState("");

  const cargarDatos = useCallback(async () => {
    if (!enabled) {
  setPedidos([]);
  setUsuarios([]);
  setSeleccionados(new Set());
  setCargando(false);
  setCargandoShare(false);
  setError("");
  return;
}

    try {
      setCargando(true);
      setError("");

      const usuariosSnap = await getDocs(collection(db, "users"));

      const nameByEmail: Record<string, string> = {};
      const listaUsuarios: Usuario[] = [];

      usuariosSnap.forEach((usuarioDoc) => {
        const data = usuarioDoc.data() as Record<string, any>;
        const email = data.email || "";

        if (!email) return;

        const nombre =
          [data.nombre, data.apellido]
            .filter(Boolean)
            .join(" ") ||
          data.displayName ||
          email;

        nameByEmail[email] = nombre;

        listaUsuarios.push({
          email,
          nombre,
          uid: data.uid,
        });
      });

      setUsuarios(
        listaUsuarios.sort((a, b) =>
          a.nombre.localeCompare(b.nombre)
        )
      );

      const pedidosQuery = query(
        collection(db, "pedidos"),
        where("proyecto", "==", proyecto)
      );

      const pedidosSnap = await getDocs(pedidosQuery);
      const pedidosBase: Pedido[] = [];

      pedidosSnap.forEach((pedidoDoc) => {
        const data = pedidoDoc.data() as Record<string, any>;
        const correo = data.correoUsuario || data.usuario || "";

        pedidosBase.push({
          id: pedidoDoc.id,
          pedidoId: pedidoDoc.id,
          titulo: data.titulo || "Sin título",
          proyecto: data.proyecto || "Sin proyecto",
          fechaEntregaReal: data.fechaEntregaReal || "",
          fechaLimite: data.fechaLimite || "",
          status: data.status || "enviado",
          correoUsuario: correo,
          nombreUsuario:
            data.nombreUsuario ||
            nameByEmail[correo] ||
            correo ||
            "Sin información",
          costo: data.costo || "",
          nombreCosto: data.nombreCosto || "",
        });
      });

      const pedidosConSubtotal = await Promise.all(
        pedidosBase.map(async (pedido) => {
          try {
            const linesRef = collection(
              db,
              "pedidos",
              pedido.pedidoId,
              "quote_live",
              "live",
              "lines"
            );

            const linesSnap = await getDocs(linesRef);
            let subtotal = 0;

            linesSnap.forEach((lineDoc) => {
              const line = lineDoc.data() as Record<string, any>;
              const value = Number(line.subtotalMXN || 0);

              if (Number.isFinite(value)) {
                subtotal += value;
              }
            });

            return {
              ...pedido,
              subtotalBaseMXN: subtotal,
            };
          } catch (subtotalError) {
            console.error(
              `Error al cargar subtotal de ${pedido.id}:`,
              subtotalError
            );

            return {
              ...pedido,
              subtotalBaseMXN: 0,
            };
          }
        })
      );

      setPedidos(
        pedidosConSubtotal
          .filter(
            (pedido) =>
              pedido.fechaEntregaReal &&
              pedido.fechaEntregaReal.trim() !== ""
          )
          .sort((a, b) => {
            const dateA = new Date(
              `${a.fechaEntregaReal}T00:00:00`
            ).getTime();

            const dateB = new Date(
              `${b.fechaEntregaReal}T00:00:00`
            ).getTime();

            return dateB - dateA;
          })
      );

      if (isAdmin) {
  setCargandoShare(true);

  const shareRef = doc(
    db,
    "proyectos_shares",
    proyecto,
  );

  const shareSnap = await getDoc(shareRef);

  if (shareSnap.exists()) {
    const data =
      shareSnap.data() as Record<string, any>;

    setSeleccionados(
      new Set(
        Array.isArray(data.users)
          ? data.users
          : [],
      ),
    );
  } else {
    setSeleccionados(new Set());
  }
} else {
  setUsuarios([]);
  setSeleccionados(new Set());
  setCargandoShare(false);
}
    } catch (loadError) {
      console.error("Error al cargar proyecto:", loadError);
      setError("No fue posible cargar los pedidos del proyecto.");
    } finally {
      setCargando(false);
      setCargandoShare(false);
    }
  }, [enabled, isAdmin, proyecto]);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

const actualizarCampo = useCallback(
  async (
    pedido: Pedido,
    campo: string,
    valor: string
  ) => {
    if (!isAdmin) {
  throw new Error(
    "No tienes permisos para modificar este pedido.",
  );
}
    const valorAnterior =
      pedido[campo as keyof Pedido] ?? "";

    /*
     * Actualización optimista.
     */
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

    try {
      /*
       * Las ejecuciones o repeticiones no tienen una
       * actividad independiente vinculada en Monday.
       * Por eso solamente sincronizamos pedidos principales.
       */
      if (
        !pedido.ejecucionId &&
        (
          campo === "fechaEntregaReal" ||
          (
            campo === "status" &&
            valor.trim().toLowerCase() === "listo"
          )
        )
      ) {
        const currentUser = auth.currentUser;

        if (!currentUser) {
          throw new Error(
            "No hay una sesión activa."
          );
        }

        const idToken =
          await currentUser.getIdToken();

        const esFecha =
          campo === "fechaEntregaReal";

        const endpoint = esFecha
          ? "/api/monday/pedidos/fecha-entrega-real"
          : "/api/monday/pedidos/status";

        const body = esFecha
          ? {
              pedidoId: pedido.pedidoId,
              fechaEntregaReal: valor,
            }
          : {
              pedidoId: pedido.pedidoId,
              status: valor,
            };

        const response = await fetch(endpoint, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(body),
        });

        const result = await response
          .json()
          .catch(() => null);

        if (!response.ok) {
          /*
           * Firebase sí cambió, pero Monday falló.
           * Conservamos el nuevo valor en la tabla.
           */
          if (result?.savedInFirebase) {
            console.error(
              "Monday no se sincronizó completamente:",
              result?.details
            );

            alert(
              result?.error ||
                "El cambio se guardó en Protolab, pero Monday no pudo sincronizarse completamente."
            );

            return;
          }

          throw new Error(
            result?.error ||
              "No se pudo actualizar el pedido."
          );
        }

        return;
      }

      /*
       * Aquí llegan:
       *
       * - Las ejecuciones o repeticiones.
       * - Los estados distintos de "listo".
       * - Cualquier otro campo.
       */
      const documentRef = pedido.ejecucionId
        ? doc(
            db,
            "pedidos",
            pedido.pedidoId,
            "ejecuciones",
            pedido.ejecucionId
          )
        : doc(
            db,
            "pedidos",
            pedido.pedidoId
          );

      await updateDoc(documentRef, {
        [campo]: valor,
      });
    } catch (updateError) {
      /*
       * La operación falló completamente:
       * restauramos el valor anterior.
       */
      setPedidos((current) =>
        current.map((item) =>
          item.id === pedido.id
            ? {
                ...item,
                [campo]: valorAnterior,
              }
            : item
        )
      );

      console.error(
        `Error actualizando ${campo}:`,
        updateError
      );

      alert(
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar el pedido."
      );

      throw updateError;
    }
  },
  [isAdmin],
);
  const toggleSeleccion = useCallback((email: string) => {
    setSeleccionados((current) => {
      const next = new Set(current);

      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }

      return next;
    });
  }, []);

  const guardarCompartir = useCallback(async () => {
    try {
      setGuardandoShare(true);

      const shareRef = doc(db, "proyectos_shares", proyecto);

      await setDoc(
        shareRef,
        {
          users: Array.from(seleccionados),
          actualizadoEn: new Date().toISOString(),
        },
        {
          merge: true,
        }
      );
    } finally {
      setGuardandoShare(false);
    }
  }, [proyecto, seleccionados]);

  const totalProyectoMXN = useMemo(
    () =>
      pedidos.reduce(
        (total, pedido) =>
          total + Number(pedido.subtotalBaseMXN || 0),
        0
      ),
    [pedidos]
  );

  return {
    pedidos,
    usuarios,
    seleccionados,
    cargando,
    cargandoShare,
    guardandoShare,
    error,
    totalProyectoMXN,
    actualizarCampo,
    toggleSeleccion,
    guardarCompartir,
    recargar: cargarDatos,
  };
}