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
import * as XLSX from "xlsx";

type ViewKey = "proyecto" | "servicios" | "materiales";

type AnalyticLine = {
  pedidoId: string;
  proyecto: string;
  fecha: Date | null;
  subtotalMXN: number;
  serviceName: string;
  material: string;
  // >>> NEW: costo de material de esa línea (opcional)
  materialCostMXN?: number;
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
  services: Record<string, ProyectoServiceInfo>; // key = normalizado
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

// Lo que se exportará
type PedidoExportRow = {
  pedidoId: string;
  proyecto: string;
  titulo: string;
  fechaPedido: string;
  fechaFinal: string;
  servicios: Set<string>;
  materiales: Set<string>;
  totalMXN: number;

  // >>> NEW: total de costo de material del pedido (suma de líneas)
  materialCostMXN: number;

  // Campos que llenó el usuario en el pedido
  servicioSolicitado?: string;
  materialSolicitado?: string;
  fechaPropuesta?: string;
  descripcion?: string;
  maquina?: string;
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

// >>> NEW: extraer costo de material desde resolvedCalc
function extractMaterialCost(resolvedCalc: Record<string, any>): number {
  if (!resolvedCalc || typeof resolvedCalc !== "object") return 0;

  const keys = ["costo_material", "costo_materiales", "costo_resina"];

  for (const k of keys) {
    const v = resolvedCalc[k];
    if (typeof v === "number" && !isNaN(v)) {
      return v;
    }
  }

  return 0;
}

const PIE_COLORS = [
  "#34D399",
  "#14B8A6",
  "#60A5FA",
  "#A78BFA",
  "#FBBF24",
  "#F472B6",
  "#FB7185",
  "#2DD4BF",
  "#818CF8",
  "#22C55E",
];

export default function AnaliticaPage() {
  const { isAdmin } = useAuth();

  const [view, setView] = useState<ViewKey>("proyecto");
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<AnalyticLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openProyecto, setOpenProyecto] = useState<string | null>(null);

  // para exportar a Excel
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
              d.fechaLimite || d.fechaEntregaReal || d.timestamp || "";
            const fechaFinal: string = d.fechaEntregaReal || "";
            const titulo: string = d.titulo || "Sin título";

            // Datos que el usuario puso en el formulario del pedido
            const servicioSolicitado: string = d.servicio || "";
            const materialSolicitado: string = d.material || "";
            const fechaPropuesta: string = d.fechaLimite || "";
            const descripcion: string = d.descripcion || "";
            const maquina: string = d.maquina || "";

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
                // >>> NEW: inicializar costo material del pedido
                materialCostMXN: 0,
                servicioSolicitado,
                materialSolicitado,
                fechaPropuesta,
                descripcion,
                maquina,
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

                // >>> NEW: calcular costo de material desde resolvedCalc
                const materialCost = extractMaterialCost(
                  (ld?.resolvedCalc as Record<string, any>) || {}
                );

                // SOLO info del cotizador
                const rawService: string =
                  ld?.selects?.serviceName ??
                  ld?.costGroupName ??
                  ld?.calcGroupName ??
                  "(sin servicio)";

                const rawMaterial: string =
                  ld?.selects?.material ?? ld?.material ?? "(sin material)";

                allLines.push({
                  pedidoId,
                  proyecto,
                  fecha,
                  subtotalMXN: subtotal,
                  serviceName: rawService,
                  material: rawMaterial,
                  // >>> NEW
                  materialCostMXN: materialCost,
                });

                // actualizar info para export
                const row = exportMap.get(pedidoId);
                if (row) {
                  row.totalMXN += subtotal;
                  row.servicios.add(rawService);
                  row.materiales.add(rawMaterial);
                  // >>> NEW: acumular costo de material del pedido
                  row.materialCostMXN += materialCost;
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

function MiniBreakdownTable({
  title,
  emptyText,
  headers,
  rows,
}: {
  title: string;
  emptyText: string;
  headers: string[];
  rows: any[][];
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-5 text-sm text-white/45">{emptyText}</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="bg-white/[0.02]">
            <tr className="text-left text-white/50">
              {headers.map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-white/10">
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-emerald-500/[0.04] transition">
                {row.map((cell, i) => (
                  <td key={i} className="px-4 py-3 text-white/75">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ChartCard({
  title,
  countLabel,
  count,
  total,
  data,
}: {
  title: string;
  countLabel: string;
  count: number;
  total: number;
  data: { name: string; value: number; mxn: number }[];
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-5 hover:bg-white/[0.04] transition">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs text-white/45">
            Distribución por proyecto
          </p>
        </div>

        <div className="text-right text-xs text-white/55">
          <div>
            {countLabel}:{" "}
            <span className="font-semibold text-white">{count}</span>
          </div>
          <div className="mt-1">
            Total:{" "}
            <span className="font-semibold text-white">
              {formatMoney(total)}
            </span>
          </div>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              outerRadius="78%"
              paddingAngle={2}
            >
              {data.map((_entry, index) => (
                <Cell
                  key={index}
                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                />
              ))}
            </Pie>

            <Tooltip
              contentStyle={{
                background: "rgba(0,0,0,0.85)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "16px",
                color: "white",
              }}
              labelStyle={{ color: "white" }}
              itemStyle={{ color: "white" }}
              formatter={(val: number, _name: string, props: any) => {
                const payload = props.payload as any;
                return [
                  `${val} usos · ${formatMoney(payload.mxn)}`,
                  "Proyecto",
                ];
              }}
            />

            <Legend
              wrapperStyle={{
                color: "rgba(255,255,255,0.65)",
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

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
  // Descargar XLSX
  // ==========================

  // Normalizador de texto (quita acentos, espacios dobles, etc.)
  function normalizeText(x: string): string {
    return x
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // quitar acentos
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " "); // quitar espacios dobles
  }

  // Capitalizar nombres bonitos
  function capitalizeWords(str: string): string {
    return str.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Convierte " 123.45" / "1,234.56" / 123.45 -> 123.45 (number)
function toExcelNumber(v: any): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.trim().replace(/,/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Fuerza ciertas columnas a tipo número y les aplica formato moneda
function applyCurrencyFormat(ws: XLSX.WorkSheet, colIdxs: number[]) {
  if (!ws["!ref"]) return;

  const range = XLSX.utils.decode_range(ws["!ref"]);

  // r=0 es header; empezamos en r=1 (primera fila de datos)
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    for (const c of colIdxs) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;

      cell.v = toExcelNumber(cell.v);
      cell.t = "n"; // number
      cell.z = '"$"#,##0.00'; // formato moneda (en Excel se verá como $)
    }
  }
}

  const handleDownloadXLSX = () => {
    if (exportRows.length === 0) return;

    // --- Hoja principal (igual que antes, + columna de material) ---
    const headerMain = [
      "Proyecto",
      "Título del pedido",
      "Fecha de pedido",
      "Fecha final",
      "Servicios cotizados",
      "Costo final del pedido",
      "Materiales utilizados",
      // >>> NEW
      "Costo material (MXN)",
    ];

    const makeRowMain = (r: PedidoExportRow) => {
      const serviciosClean = Array.from(
        new Set(
          Array.from(r.servicios).map((s) =>
            capitalizeWords(normalizeText(String(s)))
          )
        )
      ).join(", ");

      const materialesClean = Array.from(
        new Set(
          Array.from(r.materiales).map((m) =>
            capitalizeWords(normalizeText(String(m)))
          )
        )
      ).join(", ");

      return [
  r.proyecto,
  r.titulo,
  r.fechaPedido,
  r.fechaFinal,
  serviciosClean,
  r.totalMXN,          // <- number (NO toFixed)
  materialesClean,
  r.materialCostMXN,   // <- number (NO toFixed)
];

    };

    const wb = XLSX.utils.book_new();

    const mainRows = exportRows.map(makeRowMain);
    const wsMain = XLSX.utils.aoa_to_sheet([headerMain, ...mainRows]);
    // Resumen: "Costo final del pedido" = col 5, "Costo material (MXN)" = col 7
applyCurrencyFormat(wsMain, [5, 7]);

    XLSX.utils.book_append_sheet(wb, wsMain, "Resumen");

    // --- Hojas por proyecto: con comparativa pedido vs cotización ---
    const headerProyecto = [
      "Proyecto",
      "Título del pedido",
      "Fecha de pedido",
      "Fecha final",
      "Servicio solicitado",
      "Material solicitado",
      "Fecha propuesta de entrega",
      "Descripción",
      "Máquina",
      "Servicios cotizados",
      "Costo final del pedido",
      "Materiales utilizados",
      // >>> NEW
      "Costo material (MXN)",
    ];

    const makeRowProyecto = (r: PedidoExportRow) => {
      const serviciosClean = Array.from(
        new Set(
          Array.from(r.servicios).map((s) =>
            capitalizeWords(normalizeText(String(s)))
          )
        )
      ).join(", ");

      const materialesClean = Array.from(
        new Set(
          Array.from(r.materiales).map((m) =>
            capitalizeWords(normalizeText(String(m)))
          )
        )
      ).join(", ");

     return [
  r.proyecto,
  r.titulo,
  r.fechaPedido,
  r.fechaFinal,
  r.servicioSolicitado || "",
  r.materialSolicitado || "",
  r.fechaPropuesta || "",
  r.descripcion || "",
  r.maquina || "",
  serviciosClean,
  r.totalMXN,          // <- number
  materialesClean,
  r.materialCostMXN,   // <- number
];

    };

    const byProject = new Map<string, PedidoExportRow[]>();
    for (const r of exportRows) {
      const key = r.proyecto || "Sin proyecto";
      if (!byProject.has(key)) byProject.set(key, []);
      byProject.get(key)!.push(r);
    }

    byProject.forEach((rows, proyecto) => {
      const data = rows.map(makeRowProyecto);
      const safeName =
        (proyecto || "Proyecto").replace(/[\\/?*\[\]:]/g, "").slice(0, 31) ||
        "Proyecto";
      const wsProj = XLSX.utils.aoa_to_sheet([headerProyecto, ...data]);
      // Proyecto: "Costo final del pedido" = col 10, "Costo material (MXN)" = col 12
applyCurrencyFormat(wsProj, [10, 12]);

      XLSX.utils.book_append_sheet(wb, wsProj, safeName);
    });

    XLSX.writeFile(wb, "analitica_pedidos.xlsx");
  };

 return (
  <div className="min-h-[calc(100vh-120px)] text-white">
    <main className="mx-auto max-w-7xl px-5 sm:px-8 py-8 sm:py-10">
      <div className="mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">
            Analítica
          </h1>
          <p className="mt-2 text-sm text-white/60 max-w-3xl">
            Revisa el comportamiento de pedidos, servicios, materiales y costos registrados en las cotizaciones.
          </p>
        </div>

        {view === "proyecto" && (
          <button
            onClick={handleDownloadXLSX}
            disabled={exportRows.length === 0}
            className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 px-5 py-3 text-sm font-semibold text-black shadow-[0_18px_50px_-24px_rgba(45,212,191,0.75)] hover:brightness-110 hover:-translate-y-[1px] transition disabled:opacity-45 disabled:cursor-not-allowed"
          >
            Descargar XLSX
          </button>
        )}
      </div>

      {/* Tabs horizontales */}
      <div className="relative rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-2xl ring-1 ring-white/5 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.95)] overflow-hidden mb-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-emerald-500/10 to-transparent" />

        <div className="relative p-3 flex flex-col sm:flex-row gap-2">
          {[
            { key: "proyecto", label: "Por proyecto" },
            { key: "servicios", label: "Servicios" },
            { key: "materiales", label: "Materiales" },
          ].map((tab) => {
            const active = view === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => setView(tab.key as ViewKey)}
                className={[
                  "flex-1 rounded-2xl px-5 py-3 text-sm font-semibold transition border",
                  active
                    ? "bg-emerald-400/90 text-black border-emerald-300/40 shadow-[0_18px_50px_-26px_rgba(45,212,191,0.8)]"
                    : "bg-white/[0.04] text-white/70 border-white/10 hover:bg-white/[0.08] hover:text-white",
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel principal */}
      <section className="relative rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-2xl ring-1 ring-white/5 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.95)] overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-emerald-500/10 to-transparent" />

        <div className="relative p-5 sm:p-7">
          {loading && (
            <p className="text-sm text-white/60">Cargando datos…</p>
          )}

          {error && (
            <p className="text-sm text-red-300">{error}</p>
          )}

          {/* ================ POR PROYECTO ================ */}
          {view === "proyecto" && !loading && !error && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-white">
                  Analítica por proyecto
                </h2>
                <p className="mt-2 text-sm text-white/60">
                  Resumen de gasto total, cantidad de pedidos y desglose por servicios y materiales.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
                  <p className="text-sm text-white/55">Total general</p>
                  <div className="mt-1 text-2xl font-semibold text-white">
                    {formatMoney(totalGeneralMXN)}
                  </div>
                  <p className="mt-2 text-xs text-white/45">
                    Todas las líneas de cotización registradas.
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
                  <p className="text-sm text-white/55">Proyectos con gasto registrado</p>
                  <div className="mt-1 text-2xl font-semibold text-white">
                    {proyectosStats.length}
                  </div>
                  <p className="mt-2 text-xs text-white/45">
                    Proyectos con al menos una línea de cotización viva.
                  </p>
                </div>
              </div>

              <div className="relative rounded-3xl border border-white/10 bg-white/[0.035] overflow-hidden">
                <table className="w-full text-sm table-fixed">
                  <thead className="bg-white/[0.02]">
                    <tr className="text-left text-[12px] tracking-wide text-white/55">
                      <th className="py-3 px-4 font-semibold">Proyecto</th>
                      <th className="py-3 px-4 font-semibold">Pedidos / Fechas</th>
                      <th className="py-3 px-4 font-semibold">Total MXN</th>
                      <th className="py-3 px-4 font-semibold text-right">Desglose</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/10">
                    {proyectosStats.map((p) => {
                      const isOpen = openProyecto === p.proyecto;

                      const serviciosOrdenados = Object.values(p.services).sort(
                        (a, b) => b.totalMXN - a.totalMXN
                      );

                      const materialesOrdenados = Object.values(p.materials).sort(
                        (a, b) => b.totalMXN - a.totalMXN
                      );

                      return (
                        <Fragment key={p.proyecto}>
                          <tr className="hover:bg-emerald-500/[0.04] transition align-top">
                            <td className="px-4 py-4">
                              <div className="font-semibold text-white break-words">
                                {p.proyecto}
                              </div>
                            </td>

                            <td className="px-4 py-4 text-white/75">
                              <div className="font-semibold text-white/90">
                                {p.pedidosIds.size} pedido
                                {p.pedidosIds.size === 1 ? "" : "s"}
                              </div>
                              <div className="text-xs text-white/45 mt-1">
                                {formatDate(p.fechaMin)} — {formatDate(p.fechaMax)}
                              </div>
                            </td>

                            <td className="px-4 py-4 font-semibold text-white">
                              {formatMoney(p.totalMXN)}
                            </td>

                            <td className="px-4 py-4 text-right">
                              <button
                                onClick={() =>
                                  setOpenProyecto(isOpen ? null : p.proyecto)
                                }
                                className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-medium text-white/85 hover:bg-white/[0.08] transition"
                              >
                                {isOpen ? "Ocultar" : "Ver desglose"}
                              </button>
                            </td>
                          </tr>

                          {isOpen && (
                            <tr className="bg-black/25">
                              <td colSpan={4} className="px-4 py-5">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                  <MiniBreakdownTable
                                    title="Servicios cobrados"
                                    emptyText="No hay servicios registrados."
                                    headers={["Servicio", "Veces usado", "Total MXN"]}
                                    rows={serviciosOrdenados.map((info) => [
                                      info.label,
                                      info.count,
                                      formatMoney(info.totalMXN),
                                    ])}
                                  />

                                  <MiniBreakdownTable
                                    title="Materiales cobrados"
                                    emptyText="No hay materiales registrados."
                                    headers={["Material", "Veces usado", "Total MXN"]}
                                    rows={materialesOrdenados.map((info) => [
                                      info.label,
                                      info.count,
                                      formatMoney(info.totalMXN),
                                    ])}
                                  />
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
                          className="px-4 py-10 text-center text-white/45"
                        >
                          No hay líneas de cotización viva registradas todavía.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================ SERVICIOS ================ */}
          {view === "servicios" && !loading && !error && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-white">
                  Analítica por servicios
                </h2>
                <p className="mt-2 text-sm text-white/60">
                  Cada tarjeta muestra un servicio cobrado. La gráfica reparte las veces usado entre proyectos.
                </p>
              </div>

              {serviceStats.length === 0 ? (
                <p className="text-sm text-white/45">
                  No hay servicios registrados aún.
                </p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {serviceStats.map((svc, idxSvc) => {
                    const data = svc.proyectos.map((p) => ({
                      name: p.proyecto,
                      value: p.count,
                      mxn: p.totalMXN,
                    }));

                    return (
                      <ChartCard
                        key={idxSvc}
                        title={svc.serviceName}
                        countLabel="Veces total"
                        count={svc.totalCount}
                        total={svc.totalMXN}
                        data={data}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================ MATERIALES ================ */}
          {view === "materiales" && !loading && !error && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-white">
                  Analítica por materiales
                </h2>
                <p className="mt-2 text-sm text-white/60">
                  Cada tarjeta muestra un material cobrado. La gráfica reparte las veces que se usó entre proyectos.
                </p>
              </div>

              {materialStats.length === 0 ? (
                <p className="text-sm text-white/45">
                  No hay materiales registrados aún.
                </p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {materialStats.map((mat, idxMat) => {
                    const data = mat.proyectos.map((p) => ({
                      name: p.proyecto,
                      value: p.count,
                      mxn: p.totalMXN,
                    }));

                    return (
                      <ChartCard
                        key={idxMat}
                        title={mat.material}
                        countLabel="Veces total"
                        count={mat.totalCount}
                        total={mat.totalMXN}
                        data={data}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  </div>
  );
}
