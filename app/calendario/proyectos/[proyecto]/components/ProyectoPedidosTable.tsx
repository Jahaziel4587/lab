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
  page: number;
  totalPages: number;
  totalProyectoMXN: number;
  onActualizarCampo: (
    pedido: Pedido,
    campo: string,
    valor: string
  ) => Promise<void>;
};

export default function ProyectoPedidosTable({
  pedidos,
  page,
  totalPages,
  totalProyectoMXN,
  onActualizarCampo,
}: ProyectoPedidosTableProps) {
  return (
    <div className="relative rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-2xl ring-1 ring-white/5 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.95)] overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-500/10 to-transparent" />

      <div className="w-full ">
        <table className="w-full  table-fixed">
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
              <th className="py-3 px-4 font-semibold">
                Entrega propuesta
              </th>
              <th className="py-3 px-4 font-semibold">
                Entrega real
              </th>
              <th className="py-3 px-4 font-semibold text-right">
                Costos, base
              </th>
             
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
                    ID:{" "}
                    <span className="break-all">
                      {pedido.id}
                    </span>
                  </div>
                </td>

                <td className="py-2.5 px-4 text-white/75">
                  {pedido.nombreUsuario ||
                    pedido.correoUsuario ||
                    "—"}
                </td>

                <td className="py-2.5 px-4 text-white/75">
                  {pedido.fechaLimite || "—"}
                </td>

                <td className="py-2.5 px-4">
                  <input
                    type="date"
                    value={pedido.fechaEntregaReal || ""}
                    onChange={(event) => {
                      void onActualizarCampo(
                        pedido,
                        "fechaEntregaReal",
                        event.target.value
                      );
                    }}
                    className="w-[140px] rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/25 [color-scheme:dark]"
                  />
                </td>

                <td className="py-2.5 px-4 text-white/80 text-right tabular-nums">
                  {Number(pedido.subtotalBaseMXN || 0) > 0
                    ? fmtMXN(
                        Number(pedido.subtotalBaseMXN)
                      )
                    : "—"}
                </td>

            

                <td className="py-2.5 px-4">
                  <select
                    value={pedido.status || "enviado"}
                    onChange={(event) => {
                      void onActualizarCampo(
                        pedido,
                        "status",
                        event.target.value
                      );
                    }}
                    className={`${projectStatusPillClass(
                      pedido.status
                    )} [&>option]:text-black [&>option]:bg-white`}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 bg-white/[0.02] text-sm text-white/60">
        <div>
          Página{" "}
          <span className="font-semibold text-white/80">
            {page}
          </span>{" "}
          de{" "}
          <span className="font-semibold text-white/80">
            {totalPages}
          </span>
        </div>

        <div className="text-right">
          <span className="font-semibold text-white/80">
            Total gastado, subtotal base:
          </span>

          <span className="ml-2 text-white/80">
            {fmtMXN(totalProyectoMXN)}
          </span>
        </div>
      </div>
    </div>
  );
}