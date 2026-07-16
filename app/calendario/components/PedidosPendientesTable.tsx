"use client";

import Link from "next/link";
import type { Pedido } from "../types";
import { pedidoDetailHref } from "../utils";
import StatusSelect from "./StatusSelect";

type PedidosPendientesTableProps = {
  pedidos: Pedido[];
  onActualizarCampo: (
    pedido: Pedido,
    campo: string,
    valor: string
  ) => Promise<void>;
};

export default function PedidosPendientesTable({
  pedidos,
  onActualizarCampo,
}: PedidosPendientesTableProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Pedidos pendientes de fecha
          </h2>

          <p className="text-sm text-white/60">
            Asigna fecha real y ajusta el status.
          </p>
        </div>

        <div className="text-sm text-white/60">
          Mostrando{" "}
          <span className="text-white font-semibold">
            {pedidos.length}
          </span>
        </div>
      </div>

      <div className="relative rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-2xl ring-1 ring-white/5 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.95)] overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-500/10 to-transparent" />

        <div className="w-full ">
          <table className="w-full  table-fixed">
            <colgroup>
              <col className="w-[320px]" />
              <col className="w-[170px]" />
              <col className="w-[150px]" />
              <col className="w-[170px]" />
              <col className="w-[150px]" />
              <col className="w-[160px]" />
            </colgroup>

            <thead className="bg-white/[0.02]">
              <tr className="text-left text-[12px] tracking-wide text-white/55">
                <th className="py-3 px-4 font-semibold">Título</th>
                <th className="py-3 px-4 font-semibold">Solicitante</th>
                <th className="py-3 px-4 font-semibold">
                  Entrega propuesta
                </th>
                <th className="py-3 px-4 font-semibold">Entrega real</th>
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
                      className="max-w-[340px] whitespace-normal break-words leading-snug text-white/90 font-medium"
                      title={pedido.titulo}
                    >
                      {pedido.titulo}
                    </div>

                    <div className="text-[10px] text-white/35 mt-1">
                      ID:{" "}
                      <span className="break-all">
                        {pedido.id}
                      </span>
                    </div>

                    {pedido.esEjecucion && (
                      <div className="mt-1 text-[10px] text-emerald-300/70">
                        Repetición del pedido
                      </div>
                    )}
                  </td>

                  <td className="py-2.5 px-4 text-white/75">
                    {pedido.nombreUsuario ||
                      pedido.correoUsuario ||
                      "Sin información"}
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

                  <td className="py-2.5 px-4">
                    <StatusSelect
                      value={pedido.status}
                      onChange={(value) => {
                        void onActualizarCampo(
                          pedido,
                          "status",
                          value
                        );
                      }}
                    />
                  </td>

                  <td className="py-2.5 px-4">
                    <Link
                      href={pedidoDetailHref(pedido)}
                      className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-white/85 hover:bg-white/[0.08] transition"
                    >
                      Ver detalles
                    </Link>
                  </td>
                </tr>
              ))}

              {pedidos.length === 0 && (
                <tr>
                  <td
                    className="py-10 px-4 text-center text-white/45"
                    colSpan={6}
                  >
                    No hay pedidos pendientes de asignar fecha.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}