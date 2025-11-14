"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
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

type ViewKey = "proyecto" | "servicios" | "materiales";

type AnalyticLine = {
  pedidoId: string;
  proyecto: string;
  fecha: Date | null;
  subtotalMXN: number;
  serviceName: string;
  material: string;
};

type ProyectoServiceInfo = {
  label: string;
  count: number;
  totalMXN: number;
};

type ProyectoMaterialInfo = {
  label: string;
  count: number;
  totalMXN: number;
};

type ProyectoStats = {
  proyecto: string;
  pedidosIds: Set<string>;
  fechaMin: Date | null;
  fechaMax: Date | null;
  totalMXN: number;
  services: Record<string, ProyectoServiceInfo>;   // key = normalizado
  materials: Record<string, ProyectoMaterialInfo>; // key = normalizado
};

type ServiceStats = {
  serviceName: string; // etiqueta bonita
  totalCount: number;
  totalMXN: number;
  proyectos: { proyecto: string; count: number; totalMXN: number }[];
};

type MaterialStats = {
  material: string; // etiqueta bonita
  totalCount: number;
  totalMXN: number;
  proyectos: { proyecto: string; count: number; totalMXN: number }[];
};

// Lo que se exportará a CSV
type PedidoExportRow = {
  pedidoId: string;
  proyecto: string;
  titulo: string;
  fechaPedido: string;
  fechaFinal: string;
  servicios: Set<string>;
  materiales: Set<string>;
  totalMXN: number;
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

// Normalizar para agrupar claves equivalentes
function normalizeKey(x: string): string {
  return x
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const PIE_COLORS = [
  "#111827",
  "#10B981",
   "#F59E0B",
  "#4B5563",
  "#9CA3AF",
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

  // para exportar a Excel/CSV
  const [exportRows, setExportRows] = useState<PedidoExportRow[]>([]);

  useEffect(() => {
    if (!isAdmin) return;

    const cargar = async () => {
      setLoading(true);
      setError(null);
      try {
        const pedidosSnap = await getDocs(collection(db, "pedidos"));
        const allLines: AnalyticLine[] = [];

        // mapa auxiliar por pedido para armar lo que se exportará
        const exportMap = new Map<string, PedidoExportRow>();

        await Promise.all(
          pedidosSnap.docs.map(async (docSnap) => {
            const d = docSnap.data() as any;
            const pedidoId = docSnap.id;
            const proyecto = d.proyecto || "Sin proyecto";
            const status = d.status || "";

            // excluir cancelados si quieres
            if (status === "cancelado") return;

            const fechaPedido: string =
              d.fechaLimite ||
              d.fechaEntregaReal ||
              d.timestamp ||
              "";
            const fechaFinal: string = d.fechaEntregaReal || "";
            const titulo: string = d.titulo || "Sin título";

            // crear entrada base para export, aunque luego no tenga líneas
            if (!exportMap.has(pedidoId)) {
              exportMap.set(pedidoId, {
                pedidoId,
                proyecto,
                titulo,
                fechaPedido,
                fechaFinal,
                servicios: new Set<string>(),
                materiales: new Set<string>(),
                totalMXN: 0,
              });
            }

            let fecha: Date | null = null;
            if (fechaPedido && /^\d{4}-\d{2}-\d{2}/.test(fechaPedido)) {
              fecha = new Date(fechaPedido);
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

                const subtotal = Number(ld?.subtotalMXN ?? ld?.displayTotal ?? 0);
                if (!Number.isFinite(subtotal)) return;

                // SOLO info del cotizador
                const rawService: string =
                  ld?.selects?.serviceName ??
                  ld?.costGroupName ??
                  ld?.calcGroupName ??
                  "(sin servicio)";

                const rawMaterial: string =
                  ld?.selects?.material ??
                  ld?.material ??
                  "(sin material)";

                allLines.push({
                  pedidoId,
                  proyecto,
                  fecha,
                  subtotalMXN: subtotal,
                  serviceName: rawService,
                  material: rawMaterial,
                });

                // actualizar info para export
                const row = exportMap.get(pedidoId);
                if (row) {
                  row.totalMXN += subtotal;
                  row.servicios.add(rawService);
                  row.materiales.add(rawMaterial);
                }
              });
            } catch (err) {
              console.error("Error leyendo lines de", pedidoId, err);
            }
          })
        );

        setLines(allLines);
        setExportRows(Array.from(exportMap.values()));
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
   * Agregado por proyecto
   * ========================== */

  const proyectosStats = useMemo(() => {
    const map = new Map<string, ProyectoStats>();

    for (const ln of lines) {
      const keyProyecto = ln.proyecto || "Sin proyecto";
      let stats = map.get(keyProyecto);
      if (!stats) {
        stats = {
          proyecto: keyProyecto,
          pedidosIds: new Set<string>(),
          fechaMin: ln.fecha,
          fechaMax: ln.fecha,
          totalMXN: 0,
          services: {},
          materials: {},
        };
        map.set(keyProyecto, stats);
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

      // Servicios (solo desde la cotización)
      const svcLabel = ln.serviceName || "(sin servicio)";
      const svcKey = normalizeKey(svcLabel);
      if (!stats.services[svcKey]) {
        stats.services[svcKey] = {
          label: svcLabel,
          count: 0,
          totalMXN: 0,
        };
      }
      stats.services[svcKey].count += 1;
      stats.services[svcKey].totalMXN += ln.subtotalMXN;

      // Materiales (solo desde la cotización)
      const matLabel = ln.material || "(sin material)";
      const matKey = normalizeKey(matLabel);
      if (!stats.materials[matKey]) {
        stats.materials[matKey] = {
          label: matLabel,
          count: 0,
          totalMXN: 0,
        };
      }
      stats.materials[matKey].count += 1;
      stats.materials[matKey].totalMXN += ln.subtotalMXN;
    }

    return Array.from(map.values()).sort((a, b) => b.totalMXN - a.totalMXN);
  }, [lines]);

  /* ==========================
   * Aggregado por servicio
   * ========================== */

  const serviceStats = useMemo<ServiceStats[]>(() => {
    const map = new Map<
      string,
      {
        label: string;
        totalCount: number;
        totalMXN: number;
        proyectos: Map<string, { count: number; totalMXN: number }>;
      }
    >();

    for (const ln of lines) {
      const lbl = ln.serviceName || "(sin servicio)";
      const key = normalizeKey(lbl);

      let s = map.get(key);
      if (!s) {
        s = {
          label: lbl,
          totalCount: 0,
          totalMXN: 0,
          proyectos: new Map(),
        };
        map.set(key, s);
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

    return Array.from(map.values())
      .map((s) => ({
        serviceName: s.label,
        totalCount: s.totalCount,
        totalMXN: s.totalMXN,
        proyectos: Array.from(s.proyectos.entries())
          .map(([proyecto, p]) => ({ proyecto, ...p }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.totalCount - a.totalCount);
  }, [lines]);

  /* ==========================
   * Aggregado por material
   * ========================== */

  const materialStats = useMemo<MaterialStats[]>(() => {
    const map = new Map<
      string,
      {
        label: string;
        totalCount: number;
        totalMXN: number;
        proyectos: Map<string, { count: number; totalMXN: number }>;
      }
    >();

    for (const ln of lines) {
      const lbl = ln.material || "(sin material)";
      const key = normalizeKey(lbl);

      let m = map.get(key);
      if (!m) {
        m = {
          label: lbl,
          totalCount: 0,
          totalMXN: 0,
          proyectos: new Map(),
        };
        map.set(key, m);
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

    return Array.from(map.values())
      .map((m) => ({
        material: m.label,
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

  // ==========================
  // Descargar CSV
  // ==========================
  // ===============================
// Descargar CSV con BOM UTF-8
// ===============================

// Normalizador de texto (quita acentos, espacios dobles, etc.)
function normalize(x: string): string {
  return x
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")      // quitar acentos
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");                // quitar espacios dobles
}

// Capitalizar nombres bonitos
function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

const handleDownloadCSV = () => {
  if (exportRows.length === 0) return;

  const header = [
    "Proyecto",
    "Título del pedido",
    "Fecha de pedido",
    "Fecha final",
    "Servicios cotizados",
    "Costo final del pedido",
    "Materiales utilizados",
  ];

  const rows = exportRows.map((r) => {
    // NORMALIZAR + CAPITALIZAR SERVICIOS
    const serviciosClean = Array.from(
      new Set(
        Array.from(r.servicios).map((s) =>
          capitalizeWords(normalize(String(s)))
        )
      )
    ).join(", ");

    // NORMALIZAR + CAPITALIZAR MATERIALES
    const materialesClean = Array.from(
      new Set(
        Array.from(r.materiales).map((m) =>
          capitalizeWords(normalize(String(m)))
        )
      )
    ).join(", ");

    return [
      r.proyecto,
      r.titulo,
      r.fechaPedido,
      r.fechaFinal,
      serviciosClean,
      r.totalMXN.toFixed(2),
      materialesClean,
    ];
  });

  let csv = header.join(",") + "\n";

  csv += rows
    .map((row) =>
      row
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  // 🌟 UTF-8 BOM para evitar caracteres raros en Excel
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "analitica_pedidos.csv";
  a.click();
  URL.revokeObjectURL(url);
};

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
        {/* ================ POR PROYECTO ================ */}
        {view === "proyecto" && (
          <>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h1 className="text-xl font-semibold">
                Analítica por proyecto
              </h1>
              <button
                onClick={handleDownloadCSV}
                className="px-4 py-2 rounded-lg bg-black text-white text-sm hover:opacity-90"
              >
                Descargar CSV (todos los pedidos)
              </button>
            </div>

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
                        const serviciosOrdenados = Object.values(p.services).sort(
                          (a, b) => b.totalMXN - a.totalMXN
                        );
                        const materialesOrdenados = Object.values(
                          p.materials
                        ).sort((a, b) => b.totalMXN - a.totalMXN);

                        return (
                          <Fragment key={p.proyecto}>
                            <tr className="border-t">
                              <td className="px-4 py-2 align-top">
                                <div className="font-medium">
                                  {p.proyecto}
                                </div>
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
                                      Servicios cobrados en este proyecto
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
                                            {serviciosOrdenados.map((info) => (
                                              <tr
                                                key={info.label}
                                                className="border-t"
                                              >
                                                <td className="px-3 py-1.5">
                                                  {info.label}
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
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <h3 className="text-sm font-semibold mb-2">
                                      Materiales cobrados en este proyecto
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
                                            {materialesOrdenados.map((info) => (
                                              <tr
                                                key={info.label}
                                                className="border-t"
                                              >
                                                <td className="px-3 py-1.5">
                                                  {info.label}
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
                                            ))}
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

        {/* ================ SERVICIOS ================ */}
        {view === "servicios" && (
          <div>
            <h1 className="text-xl font-semibold mb-4">
              Analítica por servicios (basado en cotización)
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
                  Cada tarjeta muestra un servicio cobrado. La gráfica de pastel
                  reparte las <strong>veces usado</strong> entre proyectos.
                </p>

                {serviceStats.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No hay servicios registrados aún.
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {serviceStats.map((svc, idxSvc) => {
                    const data = svc.proyectos.map((p) => ({
                      name: p.proyecto,
                      value: p.count,
                      mxn: p.totalMXN,
                    }));

                    return (
                      <div
                        key={idxSvc}
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
                                {data.map((_entry, index) => (
                                  <Cell
                                    key={index}
                                    fill={
                                      PIE_COLORS[
                                        index % PIE_COLORS.length
                                      ]
                                    }
                                  />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(
                                  val: number,
                                  _name: string,
                                  props: any
                                ) => {
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

        {/* ================ MATERIALES ================ */}
        {view === "materiales" && (
          <div>
            <h1 className="text-xl font-semibold mb-4">
              Analítica por materiales (basado en cotización)
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
                  Cada tarjeta muestra un material cobrado. La gráfica de pastel
                  reparte las <strong>veces que se usó</strong> ese material
                  entre proyectos.
                </p>

                {materialStats.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No hay materiales registrados aún.
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {materialStats.map((mat, idxMat) => {
                    const data = mat.proyectos.map((p) => ({
                      name: p.proyecto,
                      value: p.count,
                      mxn: p.totalMXN,
                    }));

                    return (
                      <div
                        key={idxMat}
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
                                {data.map((_entry, index) => (
                                  <Cell
                                    key={index}
                                    fill={
                                      PIE_COLORS[
                                        index % PIE_COLORS.length
                                      ]
                                    }
                                  />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(
                                  val: number,
                                  _name: string,
                                  props: any
                                ) => {
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
