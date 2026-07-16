import type { Pedido } from "./types";

export const normStatus = (status?: string) =>
  String(status || "enviado").trim().toLowerCase();

export const statusLabel = (status?: string) => {
  const value = normStatus(status);

  if (value === "en proceso") return "En proceso";
  if (value === "listo") return "Listo";
  if (value === "visto") return "Visto";
  if (value === "cancelado") return "Cancelado";

  return "Enviado";
};

export const statusPillClass = (status?: string) => {
  const base =
    "appearance-none rounded-full px-4 py-1.5 text-xs font-medium border " +
    "transition cursor-pointer focus:outline-none";

  switch (normStatus(status)) {
    case "listo":
      return `${base} bg-emerald-500/15 text-emerald-300 border-emerald-500/30`;

    case "en proceso":
      return `${base} bg-yellow-500/15 text-yellow-300 border-yellow-500/30`;

    case "visto":
      return `${base} bg-blue-500/15 text-blue-300 border-blue-500/30`;

    case "cancelado":
      return `${base} bg-red-500/15 text-red-300 border-red-500/30`;

    default:
      return `${base} bg-white/10 text-white/80 border-white/20`;
  }
};

export const projectStatusPillClass = (status?: string) => {
  const base =
    "px-3 py-1 rounded-full text-[11px] font-semibold border inline-flex " +
    "items-center justify-center leading-none whitespace-nowrap";

  switch (normStatus(status)) {
    case "en proceso":
      return (
        base +
        " bg-yellow-500/12 text-yellow-200 border-yellow-400/25 " +
        "shadow-[0_12px_30px_-24px_rgba(234,179,8,0.7)]"
      );

    case "listo":
      return (
        base +
        " bg-emerald-500/12 text-emerald-200 border-emerald-400/25 " +
        "shadow-[0_12px_30px_-24px_rgba(16,185,129,0.75)]"
      );

    case "cancelado":
      return (
        base +
        " bg-red-500/12 text-red-200 border-red-400/25 " +
        "shadow-[0_12px_30px_-24px_rgba(239,68,68,0.7)]"
      );

    case "visto":
      return base + " bg-blue-500/12 text-blue-200 border-blue-400/25";

    default:
      return base + " bg-white/5 text-white/75 border-white/12";
  }
};

export const calendarPedidoClass = (status?: string) => {
  const base =
    "block text-xs rounded-lg px-2 py-1 truncate border transition";

  switch (normStatus(status)) {
    case "listo":
      return `${base} bg-emerald-500/20 text-emerald-200 border-emerald-400/40 hover:bg-emerald-500/30`;

    case "cancelado":
      return `${base} bg-red-500/20 text-red-200 border-red-400/40 hover:bg-red-500/30`;

    case "en proceso":
      return `${base} bg-yellow-500/20 text-yellow-200 border-yellow-400/40 hover:bg-yellow-500/30`;

    case "visto":
      return `${base} bg-blue-500/20 text-blue-200 border-blue-400/40 hover:bg-blue-500/30`;

    default:
      return `${base} bg-white/5 text-white/85 border-white/10 hover:bg-white/10`;
  }
};

export const actionBtnClass =
  "inline-flex items-center justify-center rounded-xl border border-white/10 " +
  "bg-white/[0.06] px-4 py-1.5 text-sm text-white/85 hover:bg-white/[0.10] " +
  "hover:border-white/15 transition shadow-[0_10px_30px_-20px_rgba(0,0,0,0.8)] " +
  "whitespace-nowrap";

export const fmtMXN = (value: number) =>
  value.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  });

export const pedidoDetailHref = (pedido: Pedido) => {
  const base = `/solicitudes/listado/${pedido.pedidoId}`;

  return pedido.ejecucionId
    ? `${base}?ejecucion=${pedido.ejecucionId}`
    : base;
};

export const getPageItems = (
  current: number,
  total: number
): Array<number | "..."> => {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const items: Array<number | "..."> = [1];

  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  if (left > 2) items.push("...");

  for (let page = left; page <= right; page += 1) {
    items.push(page);
  }

  if (right < total - 1) items.push("...");

  items.push(total);

  return items;
};