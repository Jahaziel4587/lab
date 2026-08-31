"use client";

import { useEffect, useRef, useState } from "react";
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
import AdamTutorialCard from "@/app/components/AdamTutorialCard";

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

  if (mins < 60) {
    return `Hace ${mins} min`;
  }

  const hrs = Math.floor(mins / 60);

  if (hrs < 24) {
    return `Hace ${hrs} h`;
  }

  const days = Math.floor(hrs / 24);

  return `Hace ${days} día${days === 1 ? "" : "s"}`;
}

export default function Home() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [cargandoPedidos, setCargandoPedidos] = useState(true);
  const [pedidosFrecuentes, setPedidosFrecuentes] = useState<
    PedidoFrecuente[]
  >([]);
  const [pedidosRecientes, setPedidosRecientes] = useState<Pedido[]>([]);

  const timelineRef = useRef<HTMLDivElement | null>(null);

  // Detectar usuario
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUserEmail(u?.email ?? null);
    });

    return unsub;
  }, []);

  // Cargar pedidos
  useEffect(() => {
    const cargar = async () => {
      if (!userEmail) {
        setCargandoPedidos(false);
        return;
      }

      try {
        setCargandoPedidos(true);

        const pedidosCol = collection(db, "pedidos");
        const q = query(
          pedidosCol,
          where("correoUsuario", "==", userEmail),
        );

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

        pedidos.sort((a, b) => b.timestamp - a.timestamp);

        setPedidosRecientes(pedidos.slice(0, 7));

        // Pedidos frecuentes TOP 3
        const combosMap = new Map<string, PedidoFrecuente>();

        for (const pedido of pedidos) {
          const key = [
            pedido.proyecto,
            pedido.servicio,
            pedido.material,
            pedido.maquina ?? "",
          ].join("|||");

          const existing = combosMap.get(key);

          if (existing) {
            existing.count += 1;
            existing.lastTimestamp = Math.max(
              existing.lastTimestamp,
              pedido.timestamp,
            );
          } else {
            combosMap.set(key, {
              key,
              proyecto: pedido.proyecto,
              servicio: pedido.servicio,
              material: pedido.material,
              maquina: pedido.maquina,
              count: 1,
              lastTimestamp: pedido.timestamp,
            });
          }
        }

        const combosOrdenados = Array.from(combosMap.values())
          .sort((a, b) => {
            if (b.count !== a.count) {
              return b.count - a.count;
            }

            return b.lastTimestamp - a.lastTimestamp;
          })
          .slice(0, 3);

        setPedidosFrecuentes(combosOrdenados);
      } catch (error) {
        console.error("Error cargando pedidos:", error);
      } finally {
        setCargandoPedidos(false);
      }
    };

    cargar();
  }, [userEmail]);

  const scrollTimeline = (dir: "left" | "right") => {
    const el = timelineRef.current;

    if (!el) {
      return;
    }

    const amount = Math.round(el.clientWidth * 0.85);

    el.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  const handleNuevoPedido = () => {
    router.push("/hacer-pedido/proyecto");
  };

  const handlePedidoFrecuenteClick = (
    pedidoFrecuente: PedidoFrecuente,
  ) => {
    if (typeof window !== "undefined") {
      if (pedidoFrecuente.proyecto) {
        localStorage.setItem(
          "proyecto",
          pedidoFrecuente.proyecto,
        );
      }

      if (pedidoFrecuente.servicio) {
        localStorage.setItem(
          "servicio",
          pedidoFrecuente.servicio,
        );
      }

      if (pedidoFrecuente.material) {
        localStorage.setItem(
          "material",
          pedidoFrecuente.material,
        );
      }

      if (pedidoFrecuente.maquina) {
        localStorage.setItem(
          "maquina",
          pedidoFrecuente.maquina,
        );
      }
    }

    router.push("/hacer-pedido/especificaciones");
  };

  const handleVerDetallePedido = (pedidoId: string) => {
    router.push(`/solicitudes/listado/${pedidoId}`);
  };

  return (
    <div className="min-h-[calc(100vh-140px)]">
      <main
        className="mx-auto max-w-6xl px-4 py-6 text-white
          sm:px-8 sm:py-14"
      >
        {/* Sección principal */}
        <section
          className="grid grid-cols-1 items-start gap-5
            sm:gap-8 lg:grid-cols-12 lg:gap-10"
        >
          {/* Nuevo pedido y A.D.A.M. */}
          <div className="lg:col-span-5">
            <div
              data-tutorial="card-place-order"
              className="rounded-2xl border border-white/10
                bg-white/[0.04] p-4 backdrop-blur-xl
                shadow-[0_20px_80px_-40px_rgba(0,0,0,0.8)]
                sm:rounded-3xl sm:p-7"
            >
              <button
                type="button"
                onClick={handleNuevoPedido}
                className="h-14 w-full rounded-xl
                  bg-gradient-to-r from-emerald-400 to-teal-500
                  text-base font-semibold text-black
                  shadow-[0_18px_50px_-20px_rgba(45,212,191,0.6)]
                  transition hover:-translate-y-[1px]
                  hover:brightness-110
                  sm:h-[60px] sm:rounded-2xl sm:text-lg"
              >
                Place Order
              </button>

              <p className="mt-3 text-xs leading-relaxed text-white/55">
                Select: project → service → technique → material →
                specifications.
              </p>
            </div>

            <AdamTutorialCard />
          </div>

          {/* Pedidos frecuentes */}
          <div className="lg:col-span-7">
            <div
              data-tutorial="card-frequent-orders"
              className="rounded-2xl border border-white/10
                bg-white/[0.03] p-4 backdrop-blur-xl
                sm:rounded-3xl sm:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold sm:text-xl">
                    Frequent Orders
                  </h2>

                  <p
                    className="mt-1.5 max-w-2xl text-xs
                      leading-relaxed text-white/70 sm:mt-2 sm:text-sm"
                  >
                    Shortcuts to the order combinations you use most.
                    Selecting one auto-fills the data and takes you
                    directly to specifications.
                  </p>
                </div>
              </div>

              <div className="mt-4 sm:mt-5">
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
                    Aún no hay suficiente historial para mostrar
                    pedidos frecuentes.
                  </p>
                ) : (
                  <div
                    className="grid grid-cols-1 gap-3
                      sm:grid-cols-2 sm:gap-4 xl:grid-cols-3"
                  >
                    {pedidosFrecuentes.map((pedidoFrecuente) => (
                      <button
                        type="button"
                        key={pedidoFrecuente.key}
                        onClick={() =>
                          handlePedidoFrecuenteClick(
                            pedidoFrecuente,
                          )
                        }
                        className="group rounded-2xl border
                          border-white/10 bg-white/[0.04] p-4
                          text-left
                          shadow-[0_20px_60px_-50px_rgba(0,0,0,0.9)]
                          transition hover:bg-white/[0.07]
                          sm:p-5"
                      >
                        <div
                          className="flex items-center
                            justify-between gap-3"
                        >
                          <div className="text-xs text-white/60">
                            Frequency:{" "}
                            <span className="font-semibold text-white/80">
                              {pedidoFrecuente.count}x
                            </span>
                          </div>

                          <div
                            className="flex h-9 w-9 shrink-0
                              items-center justify-center rounded-xl
                              border border-white/10 bg-white/[0.03]
                              transition group-hover:bg-white/[0.06]"
                          >
                            <FiArrowRight className="text-white/80" />
                          </div>
                        </div>

                        <div className="mt-4 space-y-3 text-sm">
                          <div>
                            <p
                              className="text-xs font-medium
                                text-white/60"
                            >
                              Project
                            </p>

                            <p
                              className="truncate font-semibold
                                text-white/90"
                            >
                              {pedidoFrecuente.proyecto}
                            </p>
                          </div>

                          <div className="h-px bg-white/10" />

                          <div>
                            <p
                              className="text-xs font-medium
                                text-white/60"
                            >
                              Service
                            </p>

                            <p className="truncate text-white/85">
                              {pedidoFrecuente.servicio}
                            </p>
                          </div>

                          <div className="h-px bg-white/10" />

                          <div>
                            <p
                              className="text-xs font-medium
                                text-white/60"
                            >
                              Material
                            </p>

                            <p className="truncate text-white/85">
                              {pedidoFrecuente.material}
                            </p>
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

        {/* Historial de pedidos */}
        <section
          data-tutorial="section-order-history"
          className="mt-8 sm:mt-14"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold sm:text-xl">
                Order History
              </h2>

              <p
                className="mt-1.5 max-w-2xl text-xs
                  leading-relaxed text-white/70 sm:mt-2 sm:text-sm"
              >
                Quickly view and edit details of your recent orders.
                Select any item to open the detailed view.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/solicitudes")}
              className="hidden items-center gap-2 rounded-xl
                border border-white/10 bg-white/[0.03] px-4 py-2
                text-sm transition hover:bg-white/[0.06]
                sm:inline-flex"
            >
              View All
              <FiArrowRight className="text-white/70" />
            </button>
          </div>

          {cargandoPedidos ? (
            <p className="mt-4 text-sm text-white/60">
              Cargando línea de tiempo de tus pedidos...
            </p>
          ) : pedidosRecientes.length === 0 ? (
            <p className="mt-4 text-sm text-white/60">
              Aún no hay pedidos recientes registrados.
            </p>
          ) : (
            <div className="relative mt-5 sm:mt-6">
              {/* Flecha izquierda */}
              <button
                type="button"
                onClick={() => scrollTimeline("left")}
                className="absolute left-0 top-1/2 z-10 hidden
                  h-10 w-10 -translate-y-1/2 items-center
                  justify-center rounded-2xl border border-white/10
                  bg-black/40 backdrop-blur transition
                  hover:bg-white/[0.06] md:flex"
                aria-label="Desplazar historial a la izquierda"
              >
                ‹
              </button>

              {/* Flecha derecha */}
              <button
                type="button"
                onClick={() => scrollTimeline("right")}
                className="absolute right-0 top-1/2 z-10 hidden
                  h-10 w-10 -translate-y-1/2 items-center
                  justify-center rounded-2xl border border-white/10
                  bg-black/40 backdrop-blur transition
                  hover:bg-white/[0.06] md:flex"
                aria-label="Desplazar historial a la derecha"
              >
                ›
              </button>

              {/* Historial desplazable */}
              <div
                ref={timelineRef}
                className="no-scrollbar overflow-x-auto
                  scroll-smooth px-2 py-2 md:px-14"
              >
                <div className="relative min-w-max">
                  <div
                    className="absolute left-0 right-0 top-1/2
                      h-px bg-white/15"
                  />

                  <div
                    className="flex min-h-[150px] snap-x
                      snap-mandatory items-center gap-6
                      sm:min-h-[160px] sm:gap-10"
                  >
                    {pedidosRecientes.map((pedido) => (
                      <div
                        key={pedido.id}
                        className="relative flex w-[170px]
                          snap-start flex-col items-center
                          sm:w-[190px]"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            handleVerDetallePedido(pedido.id)
                          }
                          className="mb-4 w-full truncate rounded-full
                            bg-emerald-400/90 px-4 py-2 text-xs
                            font-semibold text-black
                            shadow-[0_14px_40px_-22px_rgba(45,212,191,0.8)]
                            transition hover:brightness-110"
                          title={pedido.titulo}
                        >
                          {pedido.titulo}
                        </button>

                        <div
                          className="h-2.5 w-2.5 rounded-full
                            border border-black/40 bg-white shadow"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            handleVerDetallePedido(pedido.id)
                          }
                          className="mt-4 w-full truncate rounded-full
                            border border-white/15 bg-white/[0.03]
                            px-4 py-2 text-xs text-white/85
                            transition hover:bg-white/[0.06]"
                          title={pedido.proyecto || pedido.titulo}
                        >
                          {pedido.proyecto || pedido.titulo}
                        </button>

                        <div className="mt-3 text-[11px] text-white/50">
                          {formatRelative(pedido.timestamp)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div
                className="pointer-events-none absolute inset-y-0
                  left-0 w-8 bg-gradient-to-r from-black/70
                  to-transparent md:w-14"
              />

              <div
                className="pointer-events-none absolute inset-y-0
                  right-0 w-8 bg-gradient-to-l from-black/70
                  to-transparent md:w-14"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => router.push("/solicitudes")}
            className="mt-4 flex min-h-11 w-full items-center
              justify-center gap-2 rounded-xl border
              border-white/10 bg-white/[0.03] px-4 py-2
              text-sm transition hover:bg-white/[0.06] sm:hidden"
          >
            View All
            <FiArrowRight className="text-white/70" />
          </button>
        </section>
      </main>
    </div>
  );
}