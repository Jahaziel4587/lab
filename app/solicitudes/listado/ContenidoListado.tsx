"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getDocs,
  collection,
  query,
  where,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../src/firebase/firebaseConfig";
import { useAuth } from "../../../src/Context/AuthContext";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";

export default function ListadoPedidosPage() {
  const searchParams = useSearchParams();
  const proyectoSeleccionado = searchParams.get("proyecto");
  const { user, isAdmin } = useAuth();
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [esCompartidoConmigo, setEsCompartidoConmigo] = useState<boolean>(false);
  const [nameByEmail, setNameByEmail] = useState<Record<string, string>>({});
  const router = useRouter();

  const fmtMXN = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });

  // --- Cargar mapa de usuarios (email -> nombre completo) ---
  useEffect(() => {
    const cargarUsuarios = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const map: Record<string, string> = {};
        snap.forEach((docu) => {
          const u = docu.data() as any;
          if (u?.email) {
            const nombre =
              [u?.nombre, u?.apellido].filter(Boolean).join(" ") ||
              u?.displayName ||
              u.email;
            map[u.email] = nombre;
          }
        });
        setNameByEmail(map);
      } catch (e) {
        console.error("No se pudieron cargar usuarios:", e);
      }
    };
    cargarUsuarios();
  }, []);

  // 1) Revisar si el proyecto está compartido con el usuario actual
  useEffect(() => {
    const checarCompartido = async () => {
      if (!user?.email || !proyectoSeleccionado) return;
      const myEmail = String(user.email);

      try {
        const refShare = doc(db, "proyectos_shares", proyectoSeleccionado);
        const snapShare = await getDoc(refShare);
        if (snapShare.exists()) {
          const data = snapShare.data() as any;
          const arr: string[] = Array.isArray(data?.users) ? data.users : [];
          setEsCompartidoConmigo(arr.includes(myEmail));
        } else {
          setEsCompartidoConmigo(false);
        }
      } catch {
        setEsCompartidoConmigo(false);
      }
    };
    checarCompartido();
  }, [user, proyectoSeleccionado]);

  // 2) Cargar pedidos según permisos + traer costos (subtotal base) por pedido
  useEffect(() => {
    const cargarPedidos = async () => {
      if (!proyectoSeleccionado || !user?.email) return;
      const myEmail = String(user.email);

      let qBase;
      if (isAdmin || esCompartidoConmigo) {
        qBase = query(
          collection(db, "pedidos"),
          where("proyecto", "==", proyectoSeleccionado)
        );
      } else {
        qBase = query(
          collection(db, "pedidos"),
          where("proyecto", "==", proyectoSeleccionado),
          where("usuario", "==", myEmail)
        );
      }

      const querySnapshot = await getDocs(qBase);
      const listaBase = querySnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Orden opcional
      // Orden: más nuevo primero.
// 1) fechaEntregaReal (desc)  2) fechaLimite (desc)
listaBase.sort((a: any, b: any) => {
  const aR = a?.fechaEntregaReal || "";
  const bR = b?.fechaEntregaReal || "";

  // ambos con fecha real → descendente
  if (aR && bR) return bR.localeCompare(aR);

  // quien tenga fecha real va primero
  if (aR) return -1;
  if (bR) return 1;

  // sin fecha real: usar fecha propuesta → descendente
  const aP = a?.fechaLimite || "";
  const bP = b?.fechaLimite || "";
  return bP.localeCompare(aP);
});


      // Para cada pedido: sumar subtotalMXN (base) de quote_live/live/lines
      const listaConCostos = await Promise.all(
        listaBase.map(async (p: any) => {
          try {
            const linesRef = collection(db, "pedidos", p.id, "quote_live", "live", "lines");
            const linesSnap = await getDocs(linesRef);
            let subtotalBase = 0;
            linesSnap.forEach((ln) => {
              const data = ln.data() as any;
              subtotalBase += Number(data?.subtotalMXN || 0);
            });
            return { ...p, costoBaseProyecto: subtotalBase };
          } catch (err) {
            console.warn("No se pudieron leer líneas de cotización para", p.id, err);
            return { ...p, costoBaseProyecto: 0 };
          }
        })
      );

      setPedidos(listaConCostos);
    };

    cargarPedidos();
  }, [user, proyectoSeleccionado, isAdmin, esCompartidoConmigo]);

  const handleSeleccionar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const id = e.target.value;
    if (e.target.checked) {
      setSeleccionados((prev) => [...prev, id]);
    } else {
      setSeleccionados((prev) => prev.filter((pid) => pid !== id));
    }
  };

  const crearCarpeta = async (ids: string[]) => {
    const nombre = prompt("Nombre de la carpeta:");
    if (!nombre || ids.length === 0) return;

    try {
      await addDoc(collection(db, "carpetas"), {
        nombre,
        creador: user?.email || "",
        proyecto: proyectoSeleccionado,
        pedidos: ids,
        timestamp: serverTimestamp(),
      });
      alert("Carpeta creada con éxito");
    } catch (err) {
      console.error("Error al crear carpeta:", err);
      alert("Hubo un error al crear la carpeta.");
    }
  };

  const actualizarCampo = async (id: string, campo: string, valor: any) => {
    try {
      const ref = doc(db, "pedidos", id);
      await updateDoc(ref, { [campo]: valor });
      setPedidos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p))
      );
    } catch (err) {
      console.error("Error actualizando", campo, err);
    }
  };

  const subirArchivoCosto = async (
    e: React.ChangeEvent<HTMLInputElement>,
    id: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileRef = storageRef(storage, `costos/${id}/${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      await actualizarCampo(id, "costo", url);
      await actualizarCampo(id, "nombreCosto", file.name);
    } catch (err) {
      console.error("Error subiendo archivo de costo:", err);
      alert("No se pudo subir el archivo.");
    }
  };

  // --- Helper para mostrar solicitante ---
  const solicitanteDe = (p: any) => {
    const email = p?.correoUsuario || p?.usuario || "";
    return (
      p?.nombreUsuario ||
      (email ? nameByEmail[email] : "") ||
      email ||
      "-"
    );
  };

  // Total gastado en el proyecto (suma de costoBaseProyecto)
  const totalGastadoProyecto = useMemo(
    () => pedidos.reduce((acc, p: any) => acc + (Number(p?.costoBaseProyecto) || 0), 0),
    [pedidos]
  );

  if (!user || !proyectoSeleccionado) return null;

  return (
    <Suspense fallback={<div className="text-center py-10">Cargando...</div>}>
      <div>
        <button
          onClick={() => router.push("/solicitudes")}
          className="mb-6 bg-white text-black px-4 py-2 rounded hover:bg-gray-200 flex items-center gap-2"
        >
          <FiArrowLeft /> Regresar
        </button>

        <h1 className="text-xl font-semibold mb-2">
          Pedidos del proyecto:{" "}
          <span className="capitalize">{proyectoSeleccionado}</span>
        </h1>

        {/* Total del proyecto */}
        <div className="mb-4 text-sm">
          <span className="font-semibold">Total gastado (subtotal base): </span>
          <span>{fmtMXN(totalGastadoProyecto)}</span>
        </div>

        {pedidos.length === 0 ? (
          <p>No hay pedidos registrados para este proyecto.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white text-black rounded shadow-md">
              <thead>
                <tr className="bg-gray-200 text-left">
                  <th className="py-2 px-4">Título</th>
                  <th className="py-2 px-4">Solicitante</th>
                  <th className="py-2 px-4">Detalles</th>
                  <th className="py-2 px-4">Entrega propuesta</th>
                  <th className="py-2 px-4">Entrega real</th>
                  <th className="py-2 px-4">Costos (base)</th> 
                  <th className="py-2 px-4">Cotización</th>
                  <th className="py-2 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="py-2 px-4">{p.titulo || "Sin título"}</td>

                    <td className="py-2 px-4">{solicitanteDe(p)}</td>

                    <td className="py-2 px-4">
                      <Link
                        href={`/solicitudes/listado/${p.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        Ver detalles
                      </Link>
                    </td>

                    <td className="py-2 px-4">{p.fechaLimite || "-"}</td>

                    <td className="py-2 px-4">
                      {isAdmin ? (
                        <input
                          type="date"
                          value={p.fechaEntregaReal || ""}
                          onChange={(e) =>
                            actualizarCampo(p.id, "fechaEntregaReal", e.target.value)
                          }
                          className="px-2 py-1 border rounded text-black"
                        />
                      ) : (
                        p.fechaEntregaReal || "Pendiente"
                      )}
                    </td>

                    {/* COSTOS BASE (subtotal de la Cotización Viva) */}
                    <td className="py-2 px-4">
                      {p.costoBaseProyecto > 0
                        ? fmtMXN(Number(p.costoBaseProyecto))
                        : "—"}
                    </td>

                    {/* COTIZACIÓN */}
                    <td className="px-4 py-2">
                      {/* Nuevo flujo: Cotización Viva */}
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/solicitudes/listado/${p.id}#cotizacion-viva`}
                          className="inline-flex items-center justify-center px-3 py-1 rounded bg-black text-white hover:opacity-90"
                          title="Ver Cotización Viva del pedido"
                        >
                          Ver Cotización 
                        </Link>

                        {/* Compatibilidad: PDF legacy si existe */}
                        {p.costo && (
                          <div className="flex items-center gap-2">
                            <a
                              href={p.costo}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 underline"
                            >
                              {p.nombreCosto
                                ? p.nombreCosto
                                : decodeURIComponent(
                                    p.costo.split("/").pop()?.split("?")[0] || "archivo"
                                  )
                                    .split("%2F")
                                    .pop()}
                            </a>
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  actualizarCampo(p.id, "costo", "");
                                  actualizarCampo(p.id, "nombreCosto", "");
                                }}
                                className="text-red-600 hover:text-red-800 text-lg"
                                title="Eliminar archivo legacy"
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-2 px-4">
                      {isAdmin ? (
                        <select
                          value={p.status || "enviado"}
                          onChange={(e) => actualizarCampo(p.id, "status", e.target.value)}
                          className="px-2 py-1 border rounded text-black"
                        >
                          <option value="enviado">Enviado</option>
                          <option value="visto">Visto</option>
                          <option value="en proceso">En proceso</option>
                          <option value="listo">Listo</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      ) : (
                        <span className="capitalize">{p.status || "enviado"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pie con total del proyecto (opcional, ya está arriba) */}
            <div className="text-right text-sm mt-3">
              <span className="font-semibold">Total gastado (subtotal base): </span>
              <span>{fmtMXN(totalGastadoProyecto)}</span>
            </div>
          </div>
        )}

        {seleccionados.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => crearCarpeta(seleccionados)}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Crear carpeta con {seleccionados.length} pedidos
            </button>
          </div>
        )}
      </div>
    </Suspense>
  );
}
