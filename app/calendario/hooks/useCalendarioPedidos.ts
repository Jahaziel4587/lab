"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/src/firebase/firebaseConfig";
import type { Pedido } from "../types";

type FirestoreData = Record<string, unknown>;

export function useCalendarioPedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoEjecuciones, setCargandoEjecuciones] =
    useState(false);
  const [error, setError] = useState("");

  const cargarPedidos = useCallback(async () => {
    const inicioTotal = performance.now();

    try {
      setCargando(true);
      setCargandoEjecuciones(false);
      setError("");
      setPedidos([]);

      /*
       * Las consultas de usuarios y pedidos son independientes,
       * así que se ejecutan simultáneamente.
       */
      const inicioConsultas = performance.now();

      const usuariosPromise = getDocs(collection(db, "users"));

      const pedidosPromise = getDocs(
        query(
          collection(db, "pedidos"),
          orderBy("timestamp", "desc")
        )
      );

      const [usuariosSnap, pedidosSnap] = await Promise.all([
        usuariosPromise,
        pedidosPromise,
      ]);

      console.log(
        `[Calendario] Usuarios + pedidos: ${Math.round(
          performance.now() - inicioConsultas
        )} ms`
      );

      console.log(
        `[Calendario] Usuarios encontrados: ${usuariosSnap.size}`
      );

      console.log(
        `[Calendario] Pedidos encontrados: ${pedidosSnap.size}`
      );

      /*
       * Mapa de correo a nombre.
       */
      const nameByEmail: Record<string, string> = {};

      usuariosSnap.forEach((usuarioDoc) => {
        const data = usuarioDoc.data() as FirestoreData;

        const email = String(data.email || "").trim();

        if (!email) return;

        const nombreCompleto =
          [data.nombre, data.apellido]
            .filter(Boolean)
            .map(String)
            .join(" ")
            .trim() || email;

        nameByEmail[email] = nombreCompleto;
      });

      /*
       * Mapa de datos de pedidos para relacionar las ejecuciones
       * obtenidas mediante collectionGroup.
       */
      const pedidoDataById = new Map<string, FirestoreData>();

      const pedidosBase: Pedido[] = pedidosSnap.docs.map(
        (pedidoDoc) => {
          const data = pedidoDoc.data() as FirestoreData;

          pedidoDataById.set(pedidoDoc.id, data);

          const correo = String(
            data.correoUsuario ||
              data.usuario ||
              data.emailUsuario ||
              ""
          ).trim();

          return {
            id: pedidoDoc.id,
            pedidoId: pedidoDoc.id,

            titulo: String(data.titulo || "Sin título"),
            proyecto: String(data.proyecto || "Sin proyecto"),

            fechaEntregaReal: String(
              data.fechaEntregaReal || ""
            ),

            fechaLimite: String(data.fechaLimite || ""),

            costo: String(data.costo || ""),
            nombreCosto: String(data.nombreCosto || ""),

            status: String(data.status || "enviado"),

            correoUsuario: correo,

            nombreUsuario: String(
              data.nombreUsuario ||
                data.solicitadoPorNombre ||
                nameByEmail[correo] ||
                correo ||
                "Sin información"
            ),
          };
        }
      );

      /*
       * Mostramos los pedidos principales inmediatamente.
       * El calendario ya no espera las ejecuciones.
       */
      setPedidos(pedidosBase);
      setCargando(false);
      setCargandoEjecuciones(true);

      /*
       * Una sola consulta para todas las subcolecciones llamadas
       * "ejecuciones".
       */
      const inicioEjecuciones = performance.now();

      const ejecucionesSnap = await getDocs(
        collectionGroup(db, "ejecuciones")
      );

      console.log(
        `[Calendario] CollectionGroup ejecuciones: ${Math.round(
          performance.now() - inicioEjecuciones
        )} ms`
      );

      console.log(
        `[Calendario] Ejecuciones encontradas: ${ejecucionesSnap.size}`
      );

      const ejecuciones: Pedido[] = [];

      ejecucionesSnap.forEach((ejecucionDoc) => {
        /*
         * Ruta esperada:
         * pedidos/{pedidoId}/ejecuciones/{ejecucionId}
         */
        const pedidoPadreRef =
          ejecucionDoc.ref.parent.parent;

        const pedidoId = pedidoPadreRef?.id;

        if (!pedidoId) return;

        const pedidoData = pedidoDataById.get(pedidoId);

        /*
         * Evita incluir documentos de otra estructura que también
         * tengan una subcolección llamada ejecuciones.
         */
        if (!pedidoData) return;

        const ejecucion =
          ejecucionDoc.data() as FirestoreData;

        const correoEjecucion = String(
          ejecucion.solicitadoPorEmail ||
            ejecucion.correoUsuario ||
            ejecucion.usuario ||
            ""
        ).trim();

        const numero = String(
          ejecucion.numero || ""
        ).trim();

        const tituloBase = String(
          pedidoData.titulo || "Sin título"
        );

        ejecuciones.push({
          id: `${pedidoId}__${ejecucionDoc.id}`,
          pedidoId,
          ejecucionId: ejecucionDoc.id,
          esEjecucion: true,

          titulo: String(
            ejecucion.titulo ||
              (numero
                ? `${tituloBase} (${numero})`
                : `${tituloBase} · Repetición`)
          ),

          proyecto: String(
            ejecucion.proyecto ||
              pedidoData.proyecto ||
              "Sin proyecto"
          ),

          fechaLimite: String(
            ejecucion.fechaLimite || ""
          ),

          fechaEntregaReal: String(
            ejecucion.fechaEntregaReal || ""
          ),

          costo: String(ejecucion.costo || ""),

          nombreCosto: String(
            ejecucion.nombreCosto || ""
          ),

          status: String(
            ejecucion.status || "en proceso"
          ),

          correoUsuario: correoEjecucion,

          nombreUsuario: String(
            ejecucion.solicitadoPorNombre ||
              ejecucion.nombreUsuario ||
              nameByEmail[correoEjecucion] ||
              correoEjecucion ||
              "Sin información"
          ),
        });
      });

      /*
       * Orden local de ejecuciones. Evita depender de un índice
       * de Firestore para orderBy("numero").
       */
      ejecuciones.sort((a, b) => {
        const fechaA =
          a.fechaEntregaReal || a.fechaLimite || "";

        const fechaB =
          b.fechaEntregaReal || b.fechaLimite || "";

        return fechaB.localeCompare(fechaA);
      });

      setPedidos([
        ...pedidosBase,
        ...ejecuciones,
      ]);

      console.log(
        `[Calendario] Tiempo total: ${Math.round(
          performance.now() - inicioTotal
        )} ms`
      );
    } catch (loadError) {
      console.error(
        "Error al cargar el calendario:",
        loadError
      );

      setPedidos([]);
      setError(
        "No fue posible cargar los pedidos del calendario."
      );
    } finally {
      setCargando(false);
      setCargandoEjecuciones(false);
    }
  }, []);

  useEffect(() => {
    void cargarPedidos();
  }, [cargarPedidos]);

  const actualizarCampo = useCallback(
  async (
    pedido: Pedido,
    campo: string,
    valor: string
  ) => {
    const valorAnterior =
      pedido[campo as keyof Pedido];

    /*
     * Actualización optimista de la interfaz.
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
       * Los pedidos principales sincronizan su fecha real
       * con Firebase y Monday mediante el endpoint.
       */
      if (
        campo === "fechaEntregaReal" &&
        !pedido.ejecucionId
      ) {
        const currentUser = auth.currentUser;

        if (!currentUser) {
          throw new Error(
            "No hay una sesión activa."
          );
        }

        const idToken =
          await currentUser.getIdToken();

        const response = await fetch(
          "/api/monday/pedidos/fecha-entrega-real",
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              pedidoId: pedido.pedidoId,
              fechaEntregaReal: valor,
            }),
          }
        );

        const result = await response
          .json()
          .catch(() => null);

        if (!response.ok) {
          /*
           * El endpoint puede guardar correctamente en
           * Firebase aunque Monday haya fallado.
           */
          if (result?.savedInFirebase) {
            console.error(
              "La fecha se guardó en Firebase, pero Monday no se actualizó:",
              result.details
            );

            throw new Error(
              result.error ||
                "La fecha se guardó, pero no pudo sincronizarse con Monday."
            );
          }

          throw new Error(
            result?.error ||
              "No se pudo actualizar la fecha de entrega real."
          );
        }

        return;
      }

      /*
       * Las ejecuciones todavía se guardan directamente
       * en su documento de Firebase.
       *
       * Los demás campos, como status, también utilizan
       * la actualización normal de Firestore.
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
       * Si la fecha sí se guardó en Firebase pero únicamente
       * falló Monday, conservamos el nuevo valor en pantalla.
       */
      const savedInFirebase =
        updateError instanceof Error &&
        updateError.message.includes(
          "se guardó"
        );

      if (!savedInFirebase) {
        setPedidos((current) =>
          current.map((item) =>
            item.id === pedido.id
              ? {
                  ...item,
                  [campo]:
                    valorAnterior ?? "",
                }
              : item
          )
        );
      }

      console.error(
        "Error al actualizar el pedido:",
        updateError
      );

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