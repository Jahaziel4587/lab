"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { FiArrowRight } from "react-icons/fi";
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

function formatRelative(ts: number) {
  if (!ts) return "";
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days} día${days === 1 ? "" : "s"}`;
}

export default function Home() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [cargandoPedidos, setCargandoPedidos] = useState(true);
  const [pedidosFrecuentes, setPedidosFrecuentes] = useState<PedidoFrecuente[]>(
    []
  );
  const [pedidosRecientes, setPedidosRecientes] = useState<Pedido[]>([]);

  // 1) Detectar usuario
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUserEmail(u?.email ?? null);
    });
    return unsub;
  }, []);

  // 2) Cargar pedidos
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
            (data.timestamp?._seconds ? data.timestamp._seconds * 1000 : 0);

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

        pedidos.sort((a, b) => b.timestamp - a.timestamp);

        // Historial (antes tenías 7)
        setPedidosRecientes(pedidos.slice(0, 7));

        // Frecuentes TOP 3
        const combosMap = new Map<string, PedidoFrecuente>();

        for (const p of pedidos) {
          const key = `${p.proyecto}|||${p.servicio}|||${p.material}|||${
            p.maquina ?? ""
          }`;
          const existing = combosMap.get(key);

          if (existing) {
            existing.count += 1;
            existing.lastTimestamp = Math.max(existing.lastTimestamp, p.timestamp);
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



  const timelineRef = useRef<HTMLDivElement | null>(null);

const scrollTimeline = (dir: "left" | "right") => {
  const el = timelineRef.current;
  if (!el) return;

  const amount = Math.round(el.clientWidth * 0.85); // scroll por “pantalla”
  el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
};


  // Handlers
  const handleNuevoPedido = () => router.push("/hacer-pedido/proyecto");

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
    router.push(`/solicitudes/listado/${pedidoId}`);
  };

  return (
    <div className="min-h-[calc(100vh-140px)]">
      <main className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-14 text-white">
        {/* HERO */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* CTA */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_20px_80px_-40px_rgba(0,0,0,0.8)] p-6 sm:p-7">
              

              <p className="mt-2 text-sm text-white/70 leading-relaxed">
                Gestiona tus solicitudes, adjunta archivos y da seguimiento a los prototipos de tus
                proyectos en un solo lugar.
              </p>

              <button
                onClick={handleNuevoPedido}
                className="mt-6 w-full h-16 sm:h-[72px] rounded-2xl font-semibold text-lg
                  bg-gradient-to-r from-emerald-400 to-teal-500 text-black
                  shadow-[0_18px_50px_-20px_rgba(45,212,191,0.6)]
                  hover:brightness-110 hover:-translate-y-[1px] transition"
              >
                Realiza una solicitud
              </button>

              <p className="mt-3 text-xs text-white/55">
                Seleccionarás: proyecto → servicio → máquina → material →
                especificaciones.
              </p>
            </div>
          </div>

          {/* Frecuentes */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold">
                    Solicitudes frecuentes
                  </h2>
                  <p className="mt-2 text-sm text-white/70 max-w-2xl">
                    Atajos a las combinaciones de proyecto, servicio y material que más
                    utilizas. Al seleccionarlas, se llenan los datos y avanzas directo a
                    especificaciones.
                  </p>
                </div>
              </div>

              <div className="mt-5">
                {!userEmail ? (
                  <p className="text-sm text-white/60">
                    Inicia sesión para ver tus solicitudes frecuentes.
                  </p>
                ) : cargandoPedidos ? (
                  <p className="text-sm text-white/60">
                    Cargando tus pedidos frecuentes...
                  </p>
                ) : pedidosFrecuentes.length === 0 ? (
                  <p className="text-sm text-white/60">
                    Aún no hay suficiente historial para mostrar pedidos frecuentes.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {pedidosFrecuentes.map((pf) => (
                      <button
                        key={pf.key}
                        onClick={() => handlePedidoFrecuenteClick(pf)}
                        className="group text-left rounded-2xl border border-white/10 bg-white/[0.04]
                          hover:bg-white/[0.07] transition p-4 sm:p-5
                          shadow-[0_20px_60px_-50px_rgba(0,0,0,0.9)]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-white/60">
                            Frecuencia:{" "}
                            <span className="text-white/80 font-semibold">
                              {pf.count}x
                            </span>
                          </div>
                          <div
                            className="w-9 h-9 rounded-xl border border-white/10 bg-white/[0.03]
                              flex items-center justify-center
                              group-hover:bg-white/[0.06] transition"
                          >
                            <FiArrowRight className="text-white/80" />
                          </div>
                        </div>

                        <div className="mt-4 space-y-3 text-sm">
                          <div>
                            <p className="text-white/60 text-xs font-medium">
                              Proyecto
                            </p>
                            <p className="text-white/90 font-semibold truncate">
                              {pf.proyecto}
                            </p>
                          </div>

                          <div className="h-px bg-white/10" />

                          <div>
                            <p className="text-white/60 text-xs font-medium">
                              Servicio
                            </p>
                            <p className="text-white/85 truncate">{pf.servicio}</p>
                          </div>

                          <div className="h-px bg-white/10" />

                          <div>
                            <p className="text-white/60 text-xs font-medium">
                              Material
                            </p>
                            <p className="text-white/85 truncate">{pf.material}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* HISTORIAL */}
<section className="mt-10 sm:mt-14">
  <div className="flex items-end justify-between gap-4">
    <div>
      <h2 className="text-lg sm:text-xl font-semibold">Historial de solicitudes</h2>
      <p className="mt-2 text-sm text-white/70 max-w-2xl">
        Consulta y edita detalles de tus últimos pedidos de manera rápida.
        Selecciona cualquiera para ir a la vista de detalle.
      </p>
    </div>

    <button
      onClick={() => router.push("/solicitudes")}
      className="hidden sm:inline-flex items-center gap-2 text-sm
        rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2
        hover:bg-white/[0.06] transition"
    >
      Ver todos <FiArrowRight className="text-white/70" />
    </button>
  </div>

  {cargandoPedidos ? (
    <p className="text-sm text-white/60 mt-4">
      Cargando línea de tiempo de tus pedidos...
    </p>
  ) : pedidosRecientes.length === 0 ? (
    <p className="text-sm text-white/60 mt-4">Aún no hay pedidos recientes registrados.</p>
  ) : (
   <div className="mt-6 relative">
  {/* Flecha izquierda */}
  <button
    type="button"
    onClick={() => scrollTimeline("left")}
    className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10
      w-10 h-10 rounded-2xl border border-white/10 bg-black/40 backdrop-blur
      hover:bg-white/[0.06] transition items-center justify-center"
    aria-label="Scroll left"
  >
    ‹
  </button>

  {/* Flecha derecha */}
  <button
    type="button"
    onClick={() => scrollTimeline("right")}
    className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10
      w-10 h-10 rounded-2xl border border-white/10 bg-black/40 backdrop-blur
      hover:bg-white/[0.06] transition items-center justify-center"
    aria-label="Scroll right"
  >
    ›
  </button>

  {/* Contenedor scroll */}
  <div
    ref={timelineRef}
    className="no-scrollbar overflow-x-auto scroll-smooth px-2 md:px-14 py-2"
  >
    <div className="relative min-w-max">
      {/* Línea central */}
      <div className="absolute left-0 right-0 top-1/2 h-px bg-white/15" />

      {/* Snap para que se alineen bonito */}
      <div className="flex items-center gap-10 min-h-[160px] snap-x snap-mandatory">
        {pedidosRecientes.map((p) => (
          <div
            key={p.id}
            className="relative flex flex-col items-center w-[190px] snap-start"
          >
            {/* chip superior */}
            <button
              onClick={() => handleVerDetallePedido(p.id)}
              className="mb-4 w-full truncate px-4 py-2 rounded-full
                bg-emerald-400/90 text-black text-xs font-semibold
                shadow-[0_14px_40px_-22px_rgba(45,212,191,0.8)]
                hover:brightness-110 transition"
              title={p.titulo}
            >
              {p.titulo}
            </button>

            {/* nodo */}
            <div className="w-2.5 h-2.5 rounded-full bg-white shadow border border-black/40" />

            {/* chip inferior */}
            <button
              onClick={() => handleVerDetallePedido(p.id)}
              className="mt-4 w-full truncate px-4 py-2 rounded-full
                border border-white/15 bg-white/[0.03]
                hover:bg-white/[0.06] transition text-xs text-white/85"
              title={p.proyecto || p.titulo}
            >
              {p.proyecto || p.titulo}
            </button>

            {/* fecha relativa */}
            <div className="mt-3 text-[11px] text-white/50">
              {formatRelative(p.timestamp)}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>

  {/* degradados laterales para que se vea “pro” y disimule bordes */}
  <div className="pointer-events-none absolute inset-y-0 left-0 w-10 md:w-14
    bg-gradient-to-r from-black/70 to-transparent" />
  <div className="pointer-events-none absolute inset-y-0 right-0 w-10 md:w-14
    bg-gradient-to-l from-black/70 to-transparent" />
</div>

  )}
</section>

      </main>
    </div>
  );
}
