"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiSend } from "react-icons/fi";
import { auth, db } from "@/src/firebase/firebaseConfig";
import {
  collection,
  getDocs,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";

type Pedido = {
  id: string;
  titulo: string;
  proyecto: string;
  servicio: string;
  material: string;
  maquina?: string;
  timestamp: number;
};

type PedidoFrecuente = {
  key: string;
  proyecto: string;
  servicio: string;
  material: string;
  maquina?: string;
  count: number;
  lastTimestamp: number;
};

export default function Home() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [cargandoPedidos, setCargandoPedidos] = useState(true);
  const [pedidosFrecuentes, setPedidosFrecuentes] = useState<PedidoFrecuente[]>(
    []
  );
  const [pedidosRecientes, setPedidosRecientes] = useState<Pedido[]>([]);

  // 1. Detectar usuario actual
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUserEmail(u?.email ?? null);
    });
    return unsub;
  }, []);

  // 2. Cargar pedidos del usuario y calcular TOP 3 + últimos 10
  useEffect(() => {
    const cargar = async () => {
      if (!userEmail) {
        setCargandoPedidos(false);
        return;
      }

      try {
        const pedidosCol = collection(db, "pedidos");
        const q = query(pedidosCol, where("correoUsuario", "==", userEmail));
        const snap = await getDocs(q);

        const pedidos: Pedido[] = [];

        snap.forEach((docSnap) => {
          const data = docSnap.data() as DocumentData;
          const ts =
            (data.timestamp as any)?.toMillis?.() ??
            (data.timestamp?._seconds
              ? data.timestamp._seconds * 1000
              : 0);

          pedidos.push({
            id: docSnap.id,
            titulo: data.titulo ?? "Sin título",
            proyecto: data.proyecto ?? "Sin proyecto",
            servicio: data.servicio ?? "Sin servicio",
            material: data.material ?? "Sin material",
            maquina: data.maquina ?? "",
            timestamp: ts,
          });
        });

        // Ordenar de más reciente a más viejo
        pedidos.sort((a, b) => b.timestamp - a.timestamp);

        // Últimos 10 para la línea de tiempo
        setPedidosRecientes(pedidos.slice(0, 7));

        // Agrupar por proyecto + servicio + material (+ máquina) para frecuentes
        const combosMap = new Map<string, PedidoFrecuente>();

        for (const p of pedidos) {
          const key = `${p.proyecto}|||${p.servicio}|||${p.material}|||${
            p.maquina ?? ""
          }`;
          const existing = combosMap.get(key);

          if (existing) {
            existing.count += 1;
            existing.lastTimestamp = Math.max(
              existing.lastTimestamp,
              p.timestamp
            );
          } else {
            combosMap.set(key, {
              key,
              proyecto: p.proyecto,
              servicio: p.servicio,
              material: p.material,
              maquina: p.maquina,
              count: 1,
              lastTimestamp: p.timestamp,
            });
          }
        }

        const combosOrdenados = Array.from(combosMap.values())
          .sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return b.lastTimestamp - a.lastTimestamp;
          })
          .slice(0, 3);

        setPedidosFrecuentes(combosOrdenados);
      } catch (err) {
        console.error("Error cargando pedidos:", err);
      } finally {
        setCargandoPedidos(false);
      }
    };

    cargar();
  }, [userEmail]);

  // Handlers
  const handleNuevoPedido = () => {
    router.push("/hacer-pedido/proyecto");
  };

  const handlePedidoFrecuenteClick = (pf: PedidoFrecuente) => {
    if (typeof window !== "undefined") {
      if (pf.proyecto) localStorage.setItem("proyecto", pf.proyecto);
      if (pf.servicio) localStorage.setItem("servicio", pf.servicio);
      if (pf.material) localStorage.setItem("material", pf.material);
      if (pf.maquina) localStorage.setItem("maquina", pf.maquina);
    }
    router.push("/hacer-pedido/especificaciones");
  };

  const handleVerDetallePedido = (pedidoId: string) => {
    // Ruta de ver detalles de un pedido
    router.push(`/solicitudes/listado/${pedidoId}`);
  };

  // Render
  return (
    // 👉 Sin fondo gris aquí: dejamos que el layout ponga el fondo general
    <div className="min-h-screen flex">
      <main className="flex-1 mx-auto max-w-6xl px-4 sm:px-8 py-10 sm:py-14 text-white">
        {/* Fila principal: botón grande + frecuentes */}
        <section className="flex flex-col md:flex-row items-start md:items-center gap-10 md:gap-16">
          {/* Botón grande "Realiza una solicitud" */}
          <button
            onClick={handleNuevoPedido}
            className="w-full md:w-[320px] lg:w-[360px] h-40 sm:h-44 bg-[#32BAA2] text-black rounded-xl sm:rounded-2xl border-2 border-black/60 shadow-xl flex items-center justify-center text-xl sm:text-2xl font-semibold hover:bg-[#41c5ae] transition"
          >
            Realiza una solicitud
          </button>

          {/* Lado derecho: título + tarjetas de frecuentes */}
          <div className="flex-1 flex flex-col gap-4">
            <h2 className="text-lg sm:text-xl font-semibold text-white text-center md:text-left">
              Solicitudes predeterminadas de tus frecuentes
            </h2>

            <p className="text-xs sm:text-sm text-gray-200 max-w-xl text-center md:text-left">
              Atajos a las combinaciones de proyecto, servicio y material que
              más utilizas. Al seleccionarlas, se llenan los datos y avanzas
              directo a las especificaciones.
            </p>

            {userEmail ? (
              cargandoPedidos ? (
                <p className="text-xs text-gray-400 mt-2">
                  Cargando tus pedidos frecuentes...
                </p>
              ) : pedidosFrecuentes.length === 0 ? (
                <p className="text-xs text-gray-400 mt-2">
                  Aún no hay suficiente historial para mostrar pedidos
                  frecuentes. Empieza creando tus primeras solicitudes.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pedidosFrecuentes.map((pf) => (
                    <button
                      key={pf.key}
                      onClick={() => handlePedidoFrecuenteClick(pf)}
                      className="bg-white/5 hover:bg-white/10 border border-white/30 rounded-xl px-4 py-3 text-left shadow-sm transition"
                    >
                      <div className="space-y-2 text-xs sm:text-sm text-white">
                        <div>
                          <p className="font-semibold">Proyecto</p>
                          <p className="truncate text-gray-100">
                            {pf.proyecto}
                          </p>
                        </div>
                        <hr className="border-white/20" />
                        <div>
                          <p className="font-semibold">Servicio</p>
                          <p className="truncate text-gray-100">
                            {pf.servicio}
                          </p>
                        </div>
                        <hr className="border-white/20" />
                        <div>
                          <p className="font-semibold">Material</p>
                          <p className="truncate text-gray-100">
                            {pf.material}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )
            ) : (
              <p className="text-xs text-gray-400 mt-2">
                Inicia sesión para ver tus solicitudes frecuentes.
              </p>
            )}
          </div>
        </section>

        {/* SECCIÓN: Línea de tiempo de últimos 10 pedidos */}
        <section className="mt-14 space-y-4">
          <h2 className="text-lg sm:text-xl font-semibold text-white text-center md:text-left">
            Revisa / agrega detalles a tus solicitudes previas
          </h2>

          <p className="text-xs sm:text-sm text-gray-200 max-w-xl text-center md:text-left">
            Accede rápidamente al historial de tus últimos pedidos. Selecciona
            cualquiera de los títulos para ir a la vista de detalle.
          </p>

          {cargandoPedidos ? (
            <p className="text-xs text-gray-400 mt-4">
              Cargando línea de tiempo de tus pedidos...
            </p>
          ) : pedidosRecientes.length === 0 ? (
            <p className="text-xs text-gray-400 mt-4">
              Aún no hay pedidos recientes registrados.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto pb-4">
              <div className="relative flex items-center gap-7 min-h-[130px]">
                {/* Línea horizontal */}
                <div className="absolute left-0 right-0 top-1/2 h-px bg-white/30" />
                {pedidosRecientes.map((p) => (
                  <div
                    key={p.id}
                    className="relative flex flex-col items-center min-w-[140px] max-w-[190px]"
                  >
                    {/* Tarjeta superior (título) */}
                    <button
                      onClick={() => handleVerDetallePedido(p.id)}
                      className="mb-3 px-3 py-1 rounded-full bg-[#32BAA2] text-black text-[11px] sm:text-xs font-semibold hover:bg-[#41c5ae] transition truncate max-w-full"
                      title={p.titulo}
                    >
                      {p.titulo}
                    </button>

                    {/* Nodo de la línea */}
                    <div className="w-2.5 h-2.5 rounded-full bg-white shadow-md border border-black" />

                    {/* Tarjeta inferior (también título / proyecto) */}
                    <button
                      onClick={() => handleVerDetallePedido(p.id)}
                      className="mt-3 px-3 py-1 rounded-full border border-white/40 bg-white/5 hover:bg-white/15 text-[11px] sm:text-xs text-gray-100 transition truncate max-w-full"
                      title={p.proyecto || p.titulo}
                    >
                      {p.proyecto || p.titulo}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
