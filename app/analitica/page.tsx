"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/src/firebase/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "@/src/Context/AuthContext";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
// Necesario para usar <Fragment> en el tbody
import { Fragment } from "react";

type ViewKey = "proyecto" | "servicios" | "materiales";

type AnalyticLine = {
  pedidoId: string;
  proyecto: string;
  fecha: Date | null;
  subtotalMXN: number;
  serviceName: string;
  material: string;
};

type ProyectoStats = {
  proyecto: string;
  pedidosIds: Set<string>;
  fechaMin: Date | null;
  fechaMax: Date | null;
  totalMXN: number;
  services: Record<string, { count: number; totalMXN: number }>;
  materials: Record<string, { count: number; totalMXN: number }>;
};

type ServiceStats = {
  serviceName: string;
  totalCount: number;
  totalMXN: number;
  proyectos: { proyecto: string; count: number; totalMXN: number }[];
};

type MaterialStats = {
  material: string;
  totalCount: number;
  totalMXN: number;
  proyectos: { proyecto: string; count: number; totalMXN: number }[];
};

function formatMoney(n?: number) {
  const v = Number(n || 0);
  return `MXN ${v.toFixed(2)}`;
}

function formatDate(d: Date | null) {
  if (!d || Number.isNaN(d.getTime())) return "-";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const PIE_COLORS = [
  "#111827",
  "#4B5563",
  "#9CA3AF",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#EC4899",
  "#EF4444",
  "#6366F1",
  "#14B8A6",
];

export default function AnaliticaPage() {
  const { isAdmin } = useAuth();

  const [view, setView] = useState<ViewKey>("proyecto");
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<AnalyticLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openProyecto, setOpenProyecto] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    const cargar = async () => {
      setLoading(true);
      setError(null);
      try {
        const pedidosSnap = await getDocs(collection(db, "pedidos"));
        const allLines: AnalyticLine[] = [];

        await Promise.all(
          pedidosSnap.docs.map(async (docSnap) => {
            const d = docSnap.data() as any;
            const pedidoId = docSnap.id;
            const proyecto = d.proyecto || "Sin proyecto";
            const status = d.status || "";

            // Si quieres excluir cancelados:
            if (status === "cancelado") return;

            const fechaStr: string =
              d.fechaEntregaReal || d.fechaLimite || d.timestamp || "";
            let fecha: Date | null = null;
            if (fechaStr && /^\d{4}-\d{2}-\d{2}/.test(fechaStr)) {
              fecha = new Date(fechaStr);
            }

            try {
              const linesRef = collection(
                db,
                "pedidos",
                pedidoId,
                "quote_live",
                "live",
                "lines"
              );
              const linesSnap = await getDocs(linesRef);

              linesSnap.forEach((ln) => {
                const ld = ln.data() as any;
                const subtotal = Number(ld?.subtotalMXN || 0);
                if (!Number.isFinite(subtotal)) return;

                // Tomamos servicio/material desde selects, y si no, caemos al pedido
                const serviceName =
                  ld?.selects?.serviceName || d.servicio || "(sin servicio)";
                const material =
                  ld?.selects?.material || d.material || "(sin material)";

                allLines.push({
                  pedidoId,
                  proyecto,
                  fecha,
                  subtotalMXN: subtotal,
                  serviceName,
                  material,
                });
              });
            } catch (err) {
              console.error("Error leyendo lines de", pedidoId, err);
            }
          })
        );

        setLines(allLines);
      } catch (err: any) {
        console.error(err);
        setError("Error al cargar los datos de pedidos.");
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, [isAdmin]);

  /* ==========================
   * Aggregados por proyecto
   * ========================== */

  const proyectosStats = useMemo(() => {
    const map = new Map<string, ProyectoStats>();

    for (const ln of lines) {
      const key = ln.proyecto || "Sin proyecto";
      let stats = map.get(key);
      if (!stats) {
        stats = {
          proyecto: key,
          pedidosIds: new Set<string>(),
          fechaMin: ln.fecha,
          fechaMax: ln.fecha,
          totalMXN: 0,
          services: {},
          materials: {},
        };
        map.set(key, stats);
      }

      stats.pedidosIds.add(ln.pedidoId);
      stats.totalMXN += ln.subtotalMXN;

      if (ln.fecha) {
        if (!stats.fechaMin || ln.fecha < stats.fechaMin) {
          stats.fechaMin = ln.fecha;
        }
        if (!stats.fechaMax || ln.fecha > stats.fechaMax) {
          stats.fechaMax = ln.fecha;
        }
      }

      // Servicios por proyecto
      const svcKey = ln.serviceName || "(sin servicio)";
      if (!stats.services[svcKey]) {
        stats.services[svcKey] = { count: 0, totalMXN: 0 };
      }
      stats.services[svcKey].count += 1;
      stats.services[svcKey].totalMXN += ln.subtotalMXN;

      // Materiales por proyecto
      const matKey = ln.material || "(sin material)";
      if (!stats.materials[matKey]) {
        stats.materials[matKey] = { count: 0, totalMXN: 0 };
      }
      stats.materials[matKey].count += 1;
      stats.materials[matKey].totalMXN += ln.subtotalMXN;
    }

    return Array.from(map.values()).sort((a, b) => b.totalMXN - a.totalMXN);
  }, [lines]);

  /* ==========================
   * Aggregados por servicio
   * ========================== */

  const serviceStats = useMemo<ServiceStats[]>(() => {
    const map = new Map<
      string,
      {
        totalCount: number;
        totalMXN: number;
        proyectos: Map<string, { count: number; totalMXN: number }>;
      }
    >();

    for (const ln of lines) {
      const svcKey = ln.serviceName || "(sin servicio)";
      let s = map.get(svcKey);
      if (!s) {
        s = {
          totalCount: 0,
          totalMXN: 0,
          proyectos: new Map(),
        };
        map.set(svcKey, s);
      }
      s.totalCount += 1;
      s.totalMXN += ln.subtotalMXN;

      const projKey = ln.proyecto || "Sin proyecto";
      let p = s.proyectos.get(projKey);
      if (!p) {
        p = { count: 0, totalMXN: 0 };
        s.proyectos.set(projKey, p);
      }
      p.count += 1;
      p.totalMXN += ln.subtotalMXN;
    }

    return Array.from(map.entries())
      .map(([serviceName, s]) => ({
        serviceName,
        totalCount: s.totalCount,
        totalMXN: s.totalMXN,
        proyectos: Array.from(s.proyectos.entries())
          .map(([proyecto, p]) => ({ proyecto, ...p }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.totalCount - a.totalCount);
  }, [lines]);

  /* ==========================
   * Aggregados por material
   * ========================== */

  const materialStats = useMemo<MaterialStats[]>(() => {
    const map = new Map<
      string,
      {
        totalCount: number;
        totalMXN: number;
        proyectos: Map<string, { count: number; totalMXN: number }>;
      }
    >();

    for (const ln of lines) {
      const matKey = ln.material || "(sin material)";
      let m = map.get(matKey);
      if (!m) {
        m = {
          totalCount: 0,
          totalMXN: 0,
          proyectos: new Map(),
        };
        map.set(matKey, m);
      }
      m.totalCount += 1;
      m.totalMXN += ln.subtotalMXN;

      const projKey = ln.proyecto || "Sin proyecto";
      let p = m.proyectos.get(projKey);
      if (!p) {
        p = { count: 0, totalMXN: 0 };
        m.proyectos.set(projKey, p);
      }
      p.count += 1;
      p.totalMXN += ln.subtotalMXN;
    }

    return Array.from(map.entries())
      .map(([material, m]) => ({
        material,
        totalCount: m.totalCount,
        totalMXN: m.totalMXN,
        proyectos: Array.from(m.proyectos.entries())
          .map(([proyecto, p]) => ({ proyecto, ...p }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.totalCount - a.totalCount);
  }, [lines]);

  const totalGeneralMXN = useMemo(
    () => lines.reduce((acc, ln) => acc + ln.subtotalMXN, 0),
    [lines]
  );

  if (!isAdmin) {
    return (
      <div className="max-w-5xl mx-auto bg-white text-black p-6 rounded-xl shadow mt-6">
        <p>No autorizado.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto mt-6 flex gap-6 text-black">
      {/* Sidebar */}
      <aside className="w-64 bg-white rounded-2xl shadow p-4 space-y-2">
        <h2 className="font-semibold mb-2">Analítica</h2>
        <button
          onClick={() => setView("proyecto")}
          className={`w-full text-left px-3 py-2 rounded-lg border ${
            view === "proyecto"
              ? "bg-black text-white border-black"
              : "bg-white hover:bg-gray-100"
          }`}
        >
          Por proyecto
        </button>
        <button
          onClick={() => setView("servicios")}
          className={`w-full text-left px-3 py-2 rounded-lg border ${
            view === "servicios"
              ? "bg-black text-white border-black"
              : "bg-white hover:bg-gray-100"
          }`}
        >
          Servicios (gráficas)
        </button>
        <button
          onClick={() => setView("materiales")}
          className={`w-full text-left px-3 py-2 rounded-lg border ${
            view === "materiales"
              ? "bg-black text-white border-black"
              : "bg-white hover:bg-gray-100"
          }`}
        >
          Materiales (gráficas)
        </button>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 bg-white rounded-2xl shadow p-6">
        {/* ================== POR PROYECTO ================== */}
        {view === "proyecto" && (
          <>
            <h1 className="text-xl font-semibold mb-4">Analítica por proyecto</h1>

            {loading && (
              <p className="text-gray-500 text-sm mb-2">Cargando datos…</p>
            )}
            {error && (
              <p className="text-red-600 text-sm mb-2">{error}</p>
            )}

            {!loading && !error && (
              <>
                <div className="mb-4 flex flex-wrap gap-4">
                  <div className="px-4 py-3 rounded-xl bg-gray-100">
                    <div className="text-xs text-gray-500">
                      Total general (todas las líneas)
                    </div>
                    <div className="font-semibold text-lg">
                      {formatMoney(totalGeneralMXN)}
                    </div>
                  </div>
                  <div className="px-4 py-3 rounded-xl bg-gray-100">
                    <div className="text-xs text-gray-500">
                      Proyectos con gasto registrado
                    </div>
                    <div className="font-semibold text-lg">
                      {proyectosStats.length}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-gray-100 text-left">
                        <th className="px-4 py-2">Proyecto</th>
                        <th className="px-4 py-2">
                          Cantidad de pedidos
                          <br />
                          <span className="text-xs text-gray-500">
                            (rango de fechas)
                          </span>
                        </th>
                        <th className="px-4 py-2">Total MXN</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {proyectosStats.map((p) => {
                        const isOpen = openProyecto === p.proyecto;
                        const serviciosOrdenados = Object.entries(p.services).sort(
                          (a, b) => b[1].totalMXN - a[1].totalMXN
                        );
                        const materialesOrdenados = Object.entries(
                          p.materials
                        ).sort((a, b) => b[1].totalMXN - a[1].totalMXN);

                        return (
                          <Fragment key={p.proyecto}>
                            <tr className="border-t">
                              <td className="px-4 py-2 align-top">
                                <div className="font-medium">{p.proyecto}</div>
                              </td>
                              <td className="px-4 py-2 align-top">
                                <div className="font-semibold">
                                  {p.pedidosIds.size} pedido
                                  {p.pedidosIds.size === 1 ? "" : "s"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatDate(p.fechaMin)} —{" "}
                                  {formatDate(p.fechaMax)}
                                </div>
                              </td>
                              <td className="px-4 py-2 align-top font-semibold">
                                {formatMoney(p.totalMXN)}
                              </td>
                              <td className="px-4 py-2 align-top text-right">
                                <button
                                  onClick={() =>
                                    setOpenProyecto(
                                      isOpen ? null : p.proyecto
                                    )
                                  }
                                  className="text-xs px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-50"
                                >
                                  {isOpen
                                    ? "Ocultar desglose"
                                    : "Ver desglose"}
                                </button>
                              </td>
                            </tr>
                            {isOpen && (
                              <tr className="border-t bg-gray-50/60">
                                <td
                                  colSpan={4}
                                  className="px-4 py-3 space-y-4"
                                >
                                  <div>
                                    <h3 className="text-sm font-semibold mb-2">
                                      Servicios usados en este proyecto
                                    </h3>
                                    {serviciosOrdenados.length === 0 ? (
                                      <p className="text-xs text-gray-500">
                                        No hay servicios registrados.
                                      </p>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="min-w-full text-xs border rounded">
                                          <thead>
                                            <tr className="bg-gray-100 text-left">
                                              <th className="px-3 py-1.5">
                                                Servicio
                                              </th>
                                              <th className="px-3 py-1.5">
                                                Veces usado
                                              </th>
                                              <th className="px-3 py-1.5">
                                                Total MXN
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {serviciosOrdenados.map(
                                              ([svc, info]) => (
                                                <tr
                                                  key={svc}
                                                  className="border-t"
                                                >
                                                  <td className="px-3 py-1.5">
                                                    {svc}
                                                  </td>
                                                  <td className="px-3 py-1.5">
                                                    {info.count}
                                                  </td>
                                                  <td className="px-3 py-1.5">
                                                    {formatMoney(
                                                      info.totalMXN
                                                    )}
                                                  </td>
                                                </tr>
                                              )
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <h3 className="text-sm font-semibold mb-2">
                                      Materiales usados en este proyecto
                                    </h3>
                                    {materialesOrdenados.length === 0 ? (
                                      <p className="text-xs text-gray-500">
                                        No hay materiales registrados.
                                      </p>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="min-w-full text-xs border rounded">
                                          <thead>
                                            <tr className="bg-gray-100 text-left">
                                              <th className="px-3 py-1.5">
                                                Material
                                              </th>
                                              <th className="px-3 py-1.5">
                                                Veces usado
                                              </th>
                                              <th className="px-3 py-1.5">
                                                Total MXN
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {materialesOrdenados.map(
                                              ([mat, info]) => (
                                                <tr
                                                  key={mat}
                                                  className="border-t"
                                                >
                                                  <td className="px-3 py-1.5">
                                                    {mat}
                                                  </td>
                                                  <td className="px-3 py-1.5">
                                                    {info.count}
                                                  </td>
                                                  <td className="px-3 py-1.5">
                                                    {formatMoney(
                                                      info.totalMXN
                                                    )}
                                                  </td>
                                                </tr>
                                              )
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}

                      {proyectosStats.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-4 py-6 text-center text-gray-500"
                          >
                            No hay líneas de cotización viva registradas
                            todavía.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* ================== SERVICIOS ================== */}
        {view === "servicios" && (
          <div>
            <h1 className="text-xl font-semibold mb-4">
              Analítica por servicios
            </h1>

            {loading && (
              <p className="text-gray-500 text-sm mb-2">Cargando datos…</p>
            )}
            {error && (
              <p className="text-red-600 text-sm mb-2">{error}</p>
            )}

            {!loading && !error && (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Cada tarjeta muestra un servicio. La gráfica de pastel
                  reparte las <strong>veces usado</strong> entre proyectos
                  (puedes ver el proyecto y su total en el tooltip).
                </p>

                {serviceStats.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No hay servicios registrados aún.
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {serviceStats.map((svc, idxSvc) => {
                    const data = svc.proyectos.map((p, idx) => ({
                      name: p.proyecto,
                      value: p.count,
                      mxn: p.totalMXN,
                    }));

                    return (
                      <div
                        key={svc.serviceName}
                        className="border rounded-2xl p-4 bg-gray-50/60"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h2 className="text-sm font-semibold">
                            {svc.serviceName}
                          </h2>
                          <div className="text-xs text-gray-500 text-right">
                            <div>
                              Veces total:{" "}
                              <span className="font-semibold">
                                {svc.totalCount}
                              </span>
                            </div>
                            <div>
                              Total MXN:{" "}
                              <span className="font-semibold">
                                {formatMoney(svc.totalMXN)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={data}
                                dataKey="value"
                                nameKey="name"
                                outerRadius="80%"
                                paddingAngle={2}
                              >
                                {data.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={
                                      PIE_COLORS[
                                        index % PIE_COLORS.length
                                      ]
                                    }
                                  />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(val: any, _name, props: any) => {
                                  const payload = props.payload as any;
                                  return [
                                    `${val} usos · ${formatMoney(
                                      payload.mxn
                                    )}`,
                                    "Proyecto",
                                  ];
                                }}
                              />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ================== MATERIALES ================== */}
        {view === "materiales" && (
          <div>
            <h1 className="text-xl font-semibold mb-4">
              Analítica por materiales
            </h1>

            {loading && (
              <p className="text-gray-500 text-sm mb-2">Cargando datos…</p>
            )}
            {error && (
              <p className="text-red-600 text-sm mb-2">{error}</p>
            )}

            {!loading && !error && (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Cada tarjeta muestra un material. La gráfica de pastel
                  reparte las <strong>veces que ese material se usó</strong>{" "}
                  entre proyectos.
                </p>

                {materialStats.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No hay materiales registrados aún.
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {materialStats.map((mat, idxMat) => {
                    const data = mat.proyectos.map((p, idx) => ({
                      name: p.proyecto,
                      value: p.count,
                      mxn: p.totalMXN,
                    }));

                    return (
                      <div
                        key={mat.material}
                        className="border rounded-2xl p-4 bg-gray-50/60"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h2 className="text-sm font-semibold">
                            {mat.material}
                          </h2>
                          <div className="text-xs text-gray-500 text-right">
                            <div>
                              Veces total:{" "}
                              <span className="font-semibold">
                                {mat.totalCount}
                              </span>
                            </div>
                            <div>
                              Total MXN:{" "}
                              <span className="font-semibold">
                                {formatMoney(mat.totalMXN)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={data}
                                dataKey="value"
                                nameKey="name"
                                outerRadius="80%"
                                paddingAngle={2}
                              >
                                {data.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={
                                      PIE_COLORS[
                                        index % PIE_COLORS.length
                                      ]
                                    }
                                  />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(val: any, _name, props: any) => {
                                  const payload = props.payload as any;
                                  return [
                                    `${val} usos · ${formatMoney(
                                      payload.mxn
                                    )}`,
                                    "Proyecto",
                                  ];
                                }}
                              />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

