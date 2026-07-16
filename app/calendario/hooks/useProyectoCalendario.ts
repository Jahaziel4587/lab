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
import { db } from "@/src/firebase/firebaseConfig";
import type { Pedido, Usuario } from "../types";

export function useProyectoCalendario(
  proyecto: string,
  isAdmin: boolean
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
    if (!isAdmin) {
      setCargando(false);
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

      setCargandoShare(true);

      const shareRef = doc(db, "proyectos_shares", proyecto);
      const shareSnap = await getDoc(shareRef);

      if (shareSnap.exists()) {
        const data = shareSnap.data() as Record<string, any>;

        setSeleccionados(
          new Set(
            Array.isArray(data.users)
              ? data.users
              : []
          )
        );
      } else {
        setSeleccionados(new Set());
      }
    } catch (loadError) {
      console.error("Error al cargar proyecto:", loadError);
      setError("No fue posible cargar los pedidos del proyecto.");
    } finally {
      setCargando(false);
      setCargandoShare(false);
    }
  }, [isAdmin, proyecto]);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const actualizarCampo = useCallback(
    async (pedido: Pedido, campo: string, valor: string) => {
      const pedidoRef = doc(db, "pedidos", pedido.pedidoId);

      await updateDoc(pedidoRef, {
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
    },
    []
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