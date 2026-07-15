import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/src/firebase/firebaseConfig";
import { EjecucionPedido } from "../types";
import { getExecutionTitle } from "../utils";

export function usePedidoEjecuciones(id?: string, pedido?: any, user?: any) {
  const [ejecuciones, setEjecuciones] = useState<EjecucionPedido[]>([]);
  const [loadingEjecuciones, setLoadingEjecuciones] = useState(false);
  const [showRepetirModal, setShowRepetirModal] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [notas, setNotas] = useState("");
  const [creandoEjecucion, setCreandoEjecucion] = useState(false);

  const loadEjecuciones = async () => {
    if (!id) return;

    try {
      setLoadingEjecuciones(true);

      const snap = await getDocs(
        query(
          collection(db, "pedidos", id, "ejecuciones"),
          orderBy("numero", "asc")
        )
      );

      const arr: EjecucionPedido[] = [];

      snap.forEach((d) => {
        arr.push({
          id: d.id,
          ...(d.data() as Omit<EjecucionPedido, "id">),
        });
      });

      setEjecuciones(arr);
    } catch (err) {
      console.error("Error cargando ejecuciones:", err);
      setEjecuciones([]);
    } finally {
      setLoadingEjecuciones(false);
    }
  };

  useEffect(() => {
    loadEjecuciones();
  }, [id]);

  const abrirModal = () => {
    setNuevaFecha(pedido?.fechaLimite || "");
    setNotas("");
    setShowRepetirModal(true);
  };

  const cerrarModal = () => {
    if (creandoEjecucion) return;
    setShowRepetirModal(false);
  };

  const crearEjecucion = async () => {
    if (!id || !pedido || !user) return;

    if (!nuevaFecha) {
      alert("Selecciona una fecha propuesta.");
      return;
    }

    try {
      setCreandoEjecucion(true);

      const maxActual =
        ejecuciones.length === 0
          ? 1
          : Math.max(...ejecuciones.map((e) => Number(e.numero) || 1));

      const numeroSiguiente = maxActual + 1;
      const titulo = getExecutionTitle(
        pedido.titulo || "Sin título",
        numeroSiguiente
      );

      
        let nombreUsuario =
  user.displayName ||
  (user as any).name ||
  (user as any).nombre ||
  "";

if (!nombreUsuario && user.email) {
  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data() as any;

      const nombre = data.nombre || "";
      const apellido = data.apellido || "";

      nombreUsuario = `${nombre} ${apellido}`.trim();
    }
  } catch (err) {
    console.warn("No se pudo obtener el nombre del usuario:", err);
  }
}

if (!nombreUsuario) {
  nombreUsuario = user.email || "Usuario";
}

      const ejecucionRef = await addDoc(
        collection(db, "pedidos", id, "ejecuciones"),
        {
          numero: numeroSiguiente,
          titulo,
          tipo: "repeticion",
          pedidoId: id,

          fechaSolicitud: serverTimestamp(),
          fechaLimite: nuevaFecha,
          fechaEntregaReal: "",

          status: "en proceso",

          solicitadoPorUid: user.uid,
          solicitadoPorEmail: user.email || "",
          solicitadoPorNombre: nombreUsuario,

          notas: notas.trim(),

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      await addDoc(collection(db, "pedidos", id, "historial"), {
        tipo: "nueva_ejecucion",
        ejecucionId: ejecucionRef.id,
        numero: numeroSiguiente,
        titulo,
        fechaNueva: nuevaFecha,
        creadoPor: nombreUsuario,
        correoUsuario: user.email || "",
        createdAt: serverTimestamp(),
      });

      await loadEjecuciones();

      setShowRepetirModal(false);
      setNuevaFecha("");
      setNotas("");

      alert(`Nueva ejecución creada: ${titulo}`);
    } catch (err) {
      console.error("Error creando ejecución:", err);
      alert("No se pudo crear la nueva ejecución.");
    } finally {
      setCreandoEjecucion(false);
    }
  };

  return {
    ejecuciones,
    loadingEjecuciones,

    showRepetirModal,
    abrirModal,
    cerrarModal,

    nuevaFecha,
    setNuevaFecha,

    notas,
    setNotas,

    creandoEjecucion,
    crearEjecucion,

    loadEjecuciones,
  };
}