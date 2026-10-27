import type { Pedido } from "@/app/calendario/types";

type ReportOptions = {
  proyecto: string;
  monthLabel: string;
  search: string;
  pedidos: Pedido[];
  total: number;
  date: string;
  company: string;
  logo?: string | null;
};

// This document reports the exact filtered rows and base costs shown in the table.
export function buildProjectCostReport(options: ReportOptions): any {
  const money = (value: number) => `MXN ${Number(value || 0).toFixed(2)}`;
  const name = (value?: string) => {
    const trimmed = String(value || "").trim();
    return !trimmed || trimmed.includes("@") ? "Sin nombre registrado" : trimmed;
  };
  const header = (text: string) => ({ text, bold: true, color: "white", fillColor: "#1ABC80" });
  const rows = options.pedidos.map((pedido) => [
    { text: pedido.titulo || "Sin título", bold: true },
    name(pedido.nombreUsuario),
    pedido.fechaLimite || "—",
    pedido.fechaEntregaReal || "—",
    pedido.status || "enviado",
    { text: money(Number(pedido.subtotalBaseMXN || 0)), alignment: "right" },
  ]);
  return {
    pageSize: "A4", pageOrientation: "landscape", pageMargins: [36, 42, 36, 46],
    defaultStyle: { fontSize: 9 },
    content: [
      { columns: [
        { width: "*", stack: [
          ...(options.logo ? [{ image: options.logo, width: 120, margin: [0, 0, 0, 6] }] : []),
          { text: options.company, bold: true, fontSize: 12 },
          { text: "Reporte operacional de pedidos", fontSize: 11, margin: [0, 5, 0, 0] },
          { text: `Proyecto: ${options.proyecto}`, color: "#555555", margin: [0, 3, 0, 0] },
        ] },
        { width: 230, stack: [
          { text: `Fecha: ${options.date}` },
          { text: `Mes de entrega real: ${options.monthLabel}`, margin: [0, 3, 0, 0] },
          ...(options.search.trim() ? [{ text: `Búsqueda: ${options.search.trim()}`, margin: [0, 3, 0, 0] }] : []),
          { text: `Pedidos: ${options.pedidos.length}`, margin: [0, 3, 0, 0] },
        ] },
      ], margin: [0, 0, 0, 16] },
      { table: { headerRows: 1, widths: ["*", 100, 70, 70, 62, 85], body: [
        [header("Pedido"), header("Solicitante"), header("Entrega propuesta"), header("Entrega real"), header("Status"), header("Costo base")],
        ...rows,
      ] }, layout: { hLineColor: () => "#e5e7eb", vLineColor: () => "#e5e7eb", paddingTop: () => 6, paddingBottom: () => 6 }, margin: [0, 0, 0, 12] },
      { text: `Total gastado, subtotal base: ${money(options.total)}`, alignment: "right", bold: true, fontSize: 11 },
      { text: "Importes base de los servicios cotizados; sin ganancia, IVA ni envío. El filtro mensual considera la fecha real de cada ejecución. Las fechas mostradas corresponden al pedido original.", fontSize: 8, color: "#666666", margin: [0, 12, 0, 0] },
    ],
    footer: (currentPage: number, pageCount: number) => ({ text: `Página ${currentPage} de ${pageCount}`, alignment: "right", margin: [36, 0, 36, 0], fontSize: 8, color: "#777777" }),
  };
}
