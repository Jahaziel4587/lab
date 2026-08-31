"use client";

import Link from "next/link";
import type { Pedido } from "../../../types";
import {
  actionBtnClass,
  fmtMXN,
  projectStatusPillClass,
} from "../../../utils";
import { STATUS_OPTIONS } from "../../../constants";

type ProyectoPedidosTableProps = {
  pedidos: Pedido[];
  isAdmin: boolean;
  page: number;
  totalPages: number;
  totalProyectoMXN: number;
  onActualizarCampo: (
    pedido: Pedido,
    campo: string,
    valor: string
  ) => Promise<void>;
};

function statusLabel(status: any) {
  return (
    STATUS_OPTIONS.find(
      (option) =>
        option.value === String(status || "enviado").trim().toLowerCase(),
    )?.label || status || "Enviado"
  );
}

export default function ProyectoPedidosTable({
  pedidos,
  page,
  totalPages,
  isAdmin,
  totalProyectoMXN,
  onActualizarCampo,
}: ProyectoPedidosTableProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-sm sm:backdrop-blur-2xl ring-1 ring-white/5 sm:shadow-[0_30px_120px_-80px_rgba(0,0,0,0.95)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 sm:h-24 bg-gradient-to-b from-emerald-500/10 to-transparent" />

      {/* Mobile: cards legibles, sin comprimir siete columnas */}
      <div className="relative space-y-3 p-3 sm:p-4 lg:hidden">
        {pedidos.map((pedido) => (
          <article
            key={pedido.id}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="break-words text-base font-semibold leading-snug text-white/95">
                  {pedido.titulo || "Sin título"}
                </h3>
                <p className="mt-1 break-all text-[10px] text-white/35">
                  ID: {pedido.id}
                </p>
              </div>

              {!isAdmin && (
                <span className={projectStatusPillClass(pedido.status)}>
                  {statusLabel(pedido.status)}
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <div className="col-span-2">
                <div className="text-[11px] uppercase tracking-wide text-white/40">
                  Solicitante
                </div>
                <div className="mt-1 break-words text-white/80">
                  {pedido.nombreUsuario || pedido.correoUsuario || "—"}
                </div>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-wide text-white/40">
                  Entrega propuesta
                </div>
                <div className="mt-1 text-white/80">
                  {pedido.fechaLimite || "—"}
                </div>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-wide text-white/40">
                  Costos, base
                </div>
                <div className="mt-1 font-medium tabular-nums text-white/85">
                  {Number(pedido.subtotalBaseMXN || 0) > 0
                    ? fmtMXN(Number(pedido.subtotalBaseMXN))
                    : "—"}
                </div>
              </div>

              <div className="col-span-2">
                <div className="text-[11px] uppercase tracking-wide text-white/40">
                  Entrega real
                </div>
                <div className="mt-1">
                  {isAdmin ? (
                    <input
                      type="date"
                      value={pedido.fechaEntregaReal || ""}
                      onChange={(event) => {
                        void onActualizarCampo(
                          pedido,
                          "fechaEntregaReal",
                          event.target.value,
                        );
                      }}
                      className="min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/25 [color-scheme:dark]"
                    />
                  ) : (
                    <span className="text-white/80">
                      {pedido.fechaEntregaReal || "Pendiente"}
                    </span>
                  )}
                </div>
              </div>

              {isAdmin && (
                <div className="col-span-2">
                  <div className="text-[11px] uppercase tracking-wide text-white/40">
                    Status
                  </div>
                  <select
                    value={pedido.status || "enviado"}
                    onChange={(event) => {
                      void onActualizarCampo(
                        pedido,
                        "status",
                        event.target.value,
                      );
                    }}
                    className={`${projectStatusPillClass(
                      pedido.status,
                    )} mt-2 min-h-11 w-full justify-center [&>option]:bg-white [&>option]:text-black`}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <Link
              href={`/solicitudes/listado/${pedido.pedidoId}`}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-100 transition active:bg-emerald-500/20"
            >
              Ver detalles
            </Link>
          </article>
        ))}
      </div>

      {/* Desktop: conserva la tabla completa */}
      <div className="relative hidden w-full overflow-x-auto lg:block">
        <table className="w-full min-w-[1110px] table-fixed">
          <colgroup>
            <col className="w-[280px]" />
            <col className="w-[150px]" />
            <col className="w-[150px]" />
            <col className="w-[150px]" />
            <col className="w-[150px]" />
            <col className="w-[140px]" />
            <col className="w-[140px]" />
          </colgroup>

          <thead className="bg-white/[0.02]">
            <tr className="text-left text-[12px] tracking-wide text-white/55">
              <th className="py-3 px-4 font-semibold">Título</th>
              <th className="py-3 px-4 font-semibold">Solicitante</th>
              <th className="py-3 px-4 font-semibold">Entrega propuesta</th>
              <th className="py-3 px-4 font-semibold">Entrega real</th>
              <th className="py-3 px-4 font-semibold text-right">Costos, base</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold">Detalles</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/10">
            {pedidos.map((pedido) => (
              <tr
                key={pedido.id}
                className="hover:bg-emerald-500/[0.04] transition align-top"
              >
                <td className="py-2.5 px-4">
                  <div
                    className="max-w-[280px] whitespace-normal break-words leading-snug text-white/90 font-medium"
                    title={pedido.titulo}
                  >
                    {pedido.titulo || "Sin título"}
                  </div>
                  <div className="text-[10px] text-white/35 mt-1">
                    ID: <span className="break-all">{pedido.id}</span>
                  </div>
                </td>

                <td className="py-2.5 px-4 text-white/75">
                  {pedido.nombreUsuario || pedido.correoUsuario || "—"}
                </td>

                <td className="py-2.5 px-4 text-white/75">
                  {pedido.fechaLimite || "—"}
                </td>

                <td className="py-2.5 px-4">
                  {isAdmin ? (
                    <input
                      type="date"
                      value={pedido.fechaEntregaReal || ""}
                      onChange={(event) => {
                        void onActualizarCampo(
                          pedido,
                          "fechaEntregaReal",
                          event.target.value,
                        );
                      }}
                      className="w-[140px] rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/25 [color-scheme:dark]"
                    />
                  ) : (
                    <span className="text-white/75">
                      {pedido.fechaEntregaReal || "—"}
                    </span>
                  )}
                </td>

                <td className="py-2.5 px-4 text-white/80 text-right tabular-nums">
                  {Number(pedido.subtotalBaseMXN || 0) > 0
                    ? fmtMXN(Number(pedido.subtotalBaseMXN))
                    : "—"}
                </td>

                <td className="py-2.5 px-4">
                  {isAdmin ? (
                    <select
                      value={pedido.status || "enviado"}
                      onChange={(event) => {
                        void onActualizarCampo(
                          pedido,
                          "status",
                          event.target.value,
                        );
                      }}
                      className={`${projectStatusPillClass(
                        pedido.status,
                      )} [&>option]:bg-white [&>option]:text-black`}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={projectStatusPillClass(pedido.status)}>
                      {statusLabel(pedido.status)}
                    </span>
                  )}
                </td>

                <td className="py-2.5 px-4">
                  <Link
                    href={`/solicitudes/listado/${pedido.pedidoId}`}
                    className={actionBtnClass}
                  >
                    Ver detalles
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="relative flex flex-col gap-2 border-t border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between">
        <div>
          Página <span className="font-semibold text-white/80">{page}</span> de{" "}
          <span className="font-semibold text-white/80">{totalPages}</span>
        </div>

        <div className="sm:text-right">
          <span className="font-semibold text-white/80">
            Total gastado, subtotal base:
          </span>
          <span className="block text-white/80 sm:ml-2 sm:inline">
            {fmtMXN(totalProyectoMXN)}
          </span>
        </div>
      </div>
    </div>
  );
}
