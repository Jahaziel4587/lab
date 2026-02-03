"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/src/firebase/firebaseConfig";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import {
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  format,
  isSameDay,
  addMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { useAuth } from "@/src/Context/AuthContext";

type Pedido = {
  id: string;
  titulo: string;
  proyecto?: string;
  fechaEntregaReal?: string; // yyyy-MM-dd
  fechaLimite?: string; // yyyy-MM-dd
  costo?: string;
  status?: string;
  nombreCosto?: string;
  correoUsuario?: string;
  nombreUsuario?: string;
};

export default function CalendarioPage() {
  const { isAdmin } = useAuth();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [diasDelMes, setDiasDelMes] = useState<Date[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [nameByEmail, setNameByEmail] = useState<Record<string, string>>({});

  // buscador (para fechados)
  const [busquedaFechados, setBusquedaFechados] = useState("");

  // -------- cargar pedidos + nombres --------
  useEffect(() => {
    const obtenerPedidos = async () => {
      // 1) Mapear usuarios (email -> nombre)
      const usuariosSnap = await getDocs(collection(db, "users"));
      const _nameByEmail: Record<string, string> = {};
      usuariosSnap.forEach((docu) => {
        const d = docu.data() as any;
        if (d?.email) {
          _nameByEmail[d.email] =
            [d?.nombre, d?.apellido].filter(Boolean).join(" ") || d.email;
        }
      });
      setNameByEmail(_nameByEmail);

      // 2) Obtener pedidos
      const qPed = query(collection(db, "pedidos"), orderBy("timestamp", "desc"));
      const snap = await getDocs(qPed);

      const pedidosData: Pedido[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const correo = data.correoUsuario || "";
        pedidosData.push({
          id: docSnap.id,
          titulo: data.titulo || "Sin título",
          proyecto: data.proyecto || "Sin proyecto",
          fechaEntregaReal: data.fechaEntregaReal || "",
          fechaLimite: data.fechaLimite || "",
          costo: data.costo || "",
          nombreCosto: data.nombreCosto || "",
          status: data.status || "enviado",
          correoUsuario: correo,
          nombreUsuario: _nameByEmail[correo] || correo || "",
        });
      });

      setPedidos(pedidosData);
    };

    obtenerPedidos();
  }, []);

function SegmentedProgress({
  pct,
  segments = 12,
}: {
  pct: number;
  segments?: number;
}) {
  const safe = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  const filled = Math.round((safe / 100) * segments);

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 flex gap-2">
          {Array.from({ length: segments }).map((_, idx) => {
            const on = idx < filled;
            return (
              <span
                key={idx}
                className={[
                  // IMPORTANTE: altura/anchura consistentes con el look de la card
                  "h-3 w-6 rounded-full border",
                  on
                    ? "bg-emerald-400/90 border-emerald-400/40"
                    : "bg-white/[0.03] border-white/10",
                ].join(" ")}
              />
            );
          })}
        </div>

        <span className="text-xs text-white/60 w-10 text-right">{safe}%</span>
      </div>
    </div>
  );
}





  // recalcular días del mes
  useEffect(() => {
    const inicioMes = startOfMonth(currentMonth);
    const finMes = endOfMonth(currentMonth);
    setDiasDelMes(eachDayOfInterval({ start: inicioMes, end: finMes }));
  }, [currentMonth]);

  // navegación meses
  const goPrevMonth = () => setCurrentMonth((d) => addMonths(d, -1));
  const goNextMonth = () => setCurrentMonth((d) => addMonths(d, +1));

  const actualizarCampo = async (id: string, campo: string, valor: string) => {
    try {
      const refDoc = doc(db, "pedidos", id);
      await updateDoc(refDoc, { [campo]: valor });
      setPedidos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p))
      );
    } catch (error) {
      console.error("Error al actualizar campo:", error);
    }
  };

  // pedidos sin fecha real
  const pedidosSinFecha = useMemo(
    () => pedidos.filter((p) => !p.fechaEntregaReal || p.fechaEntregaReal.trim() === ""),
    [pedidos]
  );

  // pedidos con fecha real
  const pedidosConFecha = useMemo(
    () => pedidos.filter((p) => p.fechaEntregaReal && p.fechaEntregaReal.trim() !== ""),
    [pedidos]
  );

  // tarjetas por proyecto (solo con fecha real)
  const proyectosConFecha = useMemo(() => {
    const map = new Map<string, { total: number; listos: number; ultima: number }>();

    pedidosConFecha.forEach((p) => {
      const key = p.proyecto || "Sin proyecto";
      const status = (p.status || "").toLowerCase();
      const isListo = status === "listo";
      const ts = p.fechaEntregaReal ? new Date(p.fechaEntregaReal + "T00:00:00").getTime() : 0;

      const prev = map.get(key);
      if (!prev) {
        map.set(key, { total: 1, listos: isListo ? 1 : 0, ultima: ts });
      } else {
        map.set(key, {
          total: prev.total + 1,
          listos: prev.listos + (isListo ? 1 : 0),
          ultima: Math.max(prev.ultima, ts),
        });
      }
    });

    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [pedidosConFecha]);

  // buscador en fechados (cuando buscas, mostramos tabla de resultados)
  const pedidosFechadosFiltrados = useMemo(() => {
    const q = busquedaFechados.trim().toLowerCase();
    if (!q) return pedidosConFecha;

    return pedidosConFecha.filter((p) => {
      const titulo = String(p?.titulo || "").toLowerCase();
      const solicitante = String(p?.nombreUsuario || p?.correoUsuario || "").toLowerCase();
      return titulo.includes(q) || solicitante.includes(q);
    });
  }, [pedidosConFecha, busquedaFechados]);

  const mostrandoBusquedaFechados = busquedaFechados.trim().length > 0;

  // helpers UI
  const formatMes = format(currentMonth, "MMMM yyyy", { locale: es });

  const statusLabel = (s?: string) => {
    const v = (s || "enviado").toLowerCase();
    if (v === "en proceso") return "En proceso";
    if (v === "listo") return "Listo";
    if (v === "visto") return "Visto";
    if (v === "cancelado") return "Cancelado";
    return "Enviado";
  };

  const statusPillClass = (status?: string) => {
  const base =
    "appearance-none rounded-full px-4 py-1.5 text-xs font-medium border transition cursor-pointer focus:outline-none";

  switch (status) {
    case "listo":
      return `${base} bg-emerald-500/15 text-emerald-300 border-emerald-500/30`;
    case "en proceso":
      return `${base} bg-yellow-500/15 text-yellow-300 border-yellow-500/30`;
    case "visto":
      return `${base} bg-blue-500/15 text-blue-300 border-blue-500/30`;
    case "cancelado":
      return `${base} bg-red-500/15 text-red-300 border-red-500/30`;
    default: // enviado
      return `${base} bg-white/10 text-white/80 border-white/20`;
  }
};


  return (
    <div className="max-w-6xl mx-auto p-6 space-y-10">
      {/* CONTENEDOR "Mis solicitudes style" */}
      <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md shadow-[0_20px_80px_rgba(0,0,0,0.55)] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <button
            onClick={goPrevMonth}
            className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center"
            aria-label="Mes anterior"
            title="Mes anterior"
          >
            ◀
          </button>

          <div className="text-center">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-500/10 to-transparent" />

            <h1 className="text-lg md:text-xl font-semibold text-white">
              Calendario de pedidos
            </h1>
            <p className="text-sm text-white/70 capitalize">{formatMes}</p>
          </div>

          <button
            onClick={goNextMonth}
            className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center"
            aria-label="Mes siguiente"
            title="Mes siguiente"
          >
            ▶
          </button>
        </div>

        {/* Calendario */}
        <div className="p-6">
          {/* Cabecera días */}
          <div className="grid grid-cols-7 gap-3 text-xs md:text-sm text-white/70 mb-3">
            {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((dia) => (
              <div key={dia} className="text-center font-semibold">
                {dia}
              </div>
            ))}
          </div>

          {/* Cuadrícula */}
          <div className="grid grid-cols-7 gap-3">
            {(() => {
              const primerDia = diasDelMes.length > 0 ? diasDelMes[0].getDay() : 0;
              const espacios = Array(primerDia).fill(null);

              return [...espacios, ...diasDelMes].map((dia, i) => {
                if (!dia) {
                  return <div key={`empty-${i}`} className="min-h-[120px]" />;
                }

                const pedidosDelDia = pedidosConFecha.filter((p) =>
                  p.fechaEntregaReal
                    ? isSameDay(new Date(p.fechaEntregaReal + "T00:00:00"), dia)
                    : false
                );

                const esHoy =
                  isSameDay(dia, new Date());

                return (
                  <div
                    key={dia.toISOString()}
                    className={[
                      "min-h-[140px] rounded-2xl border bg-white/5 backdrop-blur-md",
                      esHoy ? "border-teal-400/40" : "border-white/10",
                      "p-3",
                      "hover:bg-white/10 transition",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-semibold">
                        {format(dia, "d", { locale: es })}
                      </span>
                      {pedidosDelDia.length > 0 && (
                        <span className="text-[11px] text-white/60">
                          {pedidosDelDia.length}
                        </span>
                      )}
                    </div>

                    {/* LISTA SCROLLEABLE (si hay muchos) */}
                    <div className="max-h-[92px] overflow-y-auto pr-1 space-y-1">
                      {pedidosDelDia.length === 0 ? (
                        <div className="text-xs text-white/35">—</div>
                      ) : (
                        pedidosDelDia.map((p) => (
                          <div key={p.id} className="w-full">
                            {isAdmin ? (
                              <Link
                                href={`/solicitudes/listado/${p.id}`}
                                className="block text-xs text-white/85 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2 py-1 truncate"
                                title={p.titulo}
                              >
                                {p.titulo}
                              </Link>
                            ) : (
                              <div
                                className="text-xs text-white/85 bg-white/5 border border-white/10 rounded-lg px-2 py-1 truncate"
                                title={p.titulo}
                              >
                                {p.titulo}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* TABLA: pedidos sin fecha real (misma vibra que "Mis solicitudes") */}
{isAdmin && (
  <div className="space-y-4">
    {/* Header opcional (puedes quitarlo si quieres) */}
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-white">
          Pedidos pendientes de fecha
        </h2>
        <p className="text-sm text-white/60">
          Asigna fecha real y ajusta status.
        </p>
      </div>

      <div className="text-sm text-white/60">
        Mostrando{" "}
        <span className="text-white font-semibold">{pedidosSinFecha.length}</span>
      </div>
    </div>

    {/* Card tabla estilo "Mis solicitudes" */}
    <div className="relative rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-2xl ring-1 ring-white/5 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.95)] overflow-hidden">
      {/* top glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-500/10 to-transparent" />

      <div className="w-full overflow-hidden">
        <table className="w-full table-fixed">
          {/* colgroup fijo (evita brincos/whitespace issues) */}
          <colgroup>
            <col className="w-[320px]" />
            <col className="w-[170px]" />
            <col className="w-[150px]" />
            <col className="w-[170px]" />
            <col className="w-[150px]" />
            <col className="w-[150px]" />
          </colgroup>

          {/* Header fino */}
          <thead className="bg-white/[0.02]">
            <tr className="text-left text-[12px] tracking-wide text-white/55">
              <th className="py-3 px-4 font-semibold">Título</th>
              <th className="py-3 px-4 font-semibold">Solicitante</th>
              <th className="py-3 px-4 font-semibold">Entrega propuesta</th>
              <th className="py-3 px-4 font-semibold">Entrega real</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold">Detalles</th>
            </tr>
          </thead>

          {/* Divisores sutiles */}
          <tbody className="divide-y divide-white/8">
            {pedidosSinFecha.map((p) => (
              <tr
                key={p.id}
                className="hover:bg-emerald-500/[0.04] transition align-top"
              >
                {/* Título compacto + wrap */}
                <td className="py-2.5 px-4">
                  <div
                    className="max-w-[340px] whitespace-normal break-words leading-snug text-white/90 font-medium"
                    title={p.titulo || ""}
                  >
                    {p.titulo}
                  </div>
                  <div className="text-[10px] text-white/35 mt-1">
                    ID: <span className="break-all">{p.id}</span>
                  </div>
                </td>

                <td className="py-2.5 px-4 text-white/75">
                  {p.nombreUsuario || p.correoUsuario || "Sin información"}
                </td>

                <td className="py-2.5 px-4 text-white/75">
                  {p.fechaLimite || "—"}
                </td>

                <td className="py-2.5 px-4">
                  <input
                    type="date"
                    value={p.fechaEntregaReal ?? ""}
                    onChange={(e) =>
                      actualizarCampo(p.id, "fechaEntregaReal", e.target.value)
                    }
                    className="w-[140px] rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                  />
                </td>

                <td className="py-2.5 px-4">
                  <select
                    value={p.status || "enviado"}
                    onChange={(e) =>
                      actualizarCampo(p.id, "status", e.target.value)
                    }
                    className={statusPillClass(p.status || "enviado")}
                  >
                    <option value="enviado">Enviado</option>
                    <option value="visto">Visto</option>
                    <option value="en proceso">En proceso</option>
                    <option value="listo">Listo</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </td>

                <td className="py-2.5 px-4">
                  <Link
                    href={`/solicitudes/listado/${p.id}`}
                    className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-white/85 hover:bg-white/[0.08] transition"
                  >
                    Ver detalles
                  </Link>
                </td>
              </tr>
            ))}

            {pedidosSinFecha.length === 0 && (
              <tr>
                <td className="py-10 px-4 text-center text-white/45" colSpan={6}>
                  No hay pedidos pendientes de asignar fecha.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
)}


      {/* Proyectos con pedidos fechados (tarjetas estilo Mis solicitudes) */}
      {isAdmin && (
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md shadow-[0_20px_80px_rgba(0,0,0,0.55)] overflow-hidden">
          <div className="px-6 py-5 border-b border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Proyectos con pedidos fechados
              </h2>
              <p className="text-sm text-white/60">
                Busca por título o solicitante, o entra por proyecto.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <input
                type="text"
                value={busquedaFechados}
                onChange={(e) => setBusquedaFechados(e.target.value)}
                placeholder="Buscar pedido (título / solicitante)..."
                className="w-full sm:w-[420px] px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/40 outline-none"
              />
              {mostrandoBusquedaFechados && (
                <button
                  onClick={() => setBusquedaFechados("")}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white"
                  title="Limpiar"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Si hay búsqueda: tabla de resultados (mismo estilo) */}
          {mostrandoBusquedaFechados ? (
            <div className="p-6 space-y-3">
              <div className="text-sm text-white/60">
                Mostrando{" "}
                <span className="text-white font-semibold">{pedidosFechadosFiltrados.length}</span>{" "}
                de <span className="text-white font-semibold">{pedidosConFecha.length}</span>{" "}
                pedidos.
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-white/85">
                  <thead className="text-left text-white/55">
                    <tr className="border-b border-white/10">
                      <th className="px-6 py-4 font-semibold">Título</th>
                      <th className="px-6 py-4 font-semibold">Solicitante</th>
                      <th className="px-6 py-4 font-semibold">Entrega propuesta</th>
                      <th className="px-6 py-4 font-semibold">Entrega real</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Detalles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidosFechadosFiltrados.map((p) => (
                      <tr key={p.id} className="border-b border-white/10 hover:bg-white/5">
                        <td className="px-6 py-4">
                          <div className="font-medium text-white">{p.titulo}</div>
                          <div className="text-xs text-white/35">ID: {p.id}</div>
                        </td>
                        <td className="px-6 py-4">
                          {p.nombreUsuario || p.correoUsuario || "Sin información"}
                        </td>
                        <td className="px-6 py-4">{p.fechaLimite || "—"}</td>
                        <td className="px-6 py-4">{p.fechaEntregaReal || "—"}</td>
                        <td className="px-6 py-4">
                          <span
                            className={[
                              "inline-flex items-center px-4 py-2 rounded-full border",
                              statusPillClass(p.status),
                            ].join(" ")}
                          >
                            {statusLabel(p.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/solicitudes/listado/${p.id}`}
                            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white"
                          >
                            Ver detalles
                          </Link>
                        </td>
                      </tr>
                    ))}

                    {pedidosFechadosFiltrados.length === 0 && (
                      <tr>
                        <td className="px-6 py-10 text-center text-white/45" colSpan={6}>
                          No hay resultados para esa búsqueda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            // Si NO hay búsqueda: tarjetas por proyecto estilo Mis solicitudes
            <div className="p-6">
              {proyectosConFecha.length === 0 ? (
                <p className="text-sm text-white/60">
                  Aún no hay pedidos con <em>fecha real</em>.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {proyectosConFecha.map(([proyecto, stats]) => {
                    const pct =
                      stats.total > 0 ? Math.round((stats.listos / stats.total) * 100) : 0;

                    // “última actividad” simple en días (aprox)
                    const dias =
                      stats.ultima > 0
                        ? Math.max(0, Math.round((Date.now() - stats.ultima) / (1000 * 60 * 60 * 24)))
                        : null;

                    return (
                      <Link
                        key={proyecto}
                        href={`/calendario/proyectos/${encodeURIComponent(proyecto)}`}
                        className="group rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition overflow-hidden"
                      >
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xl font-semibold text-white truncate">
                                {proyecto}
                              </div>
                              <div className="text-sm text-white/60">
                                Última actividad:{" "}
                                {dias === null ? "—" : dias === 0 ? "Hoy" : `Hace ${dias} días`}
                              </div>
                            </div>

                            <div className="h-12 w-12 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-white/80 group-hover:text-white">
                              →
                            </div>
                          </div>

                          <div className="mt-4 flex gap-2">
                            <div className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/80 text-sm">
                              Pedidos: <span className="text-white font-semibold">{stats.total}</span>
                            </div>
                            <div className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/80 text-sm">
                              Listos: <span className="text-white font-semibold">{stats.listos}</span>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center gap-3">
                            {/* mini progress bar con “píldoras” */}
                            <div className="flex-1 flex gap-2">
                              {Array.from({ length: 9 }).map((_, idx) => {
                                const filled = idx < Math.round((pct / 100) * 9);
                                return (
                                  <span
                                    key={idx}
                                    className={[
                                      "h-2 w-5 rounded-full border",
                                      filled
                                        ? "bg-emerald-400/90 border-emerald-400/40"
                                        : "bg-white/5 border-white/10",
                                    ].join(" ")}
                                  />
                                );
                              })}
                            </div>
                            <div className="text-sm text-white/70 w-10 text-right">
                              {pct}%
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between text-sm text-white/60">
                            <span>Porcentaje de solicitudes terminadas</span>
                            <span className="text-white/80">Ver proyecto</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
