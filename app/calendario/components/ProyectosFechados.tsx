"use client";

import Link from "next/link";
import type { Pedido, ProyectoStats } from "../types";
import {
  pedidoDetailHref,
  statusLabel,
  statusPillClass,
} from "../utils";
import ProyectoCard from "./ProyectoCard";
import SearchInput from "./SearchInput";

type ProyectoEntry = [string, ProyectoStats];

type ProyectosFechadosProps = {
  proyectos: ProyectoEntry[];
  pedidos: Pedido[];
  totalPedidos: number;
  busqueda: string;
  onBusquedaChange: (value: string) => void;
};

export default function ProyectosFechados({
  proyectos,
  pedidos,
  totalPedidos,
  busqueda,
  onBusquedaChange,
}: ProyectosFechadosProps) {
  const mostrandoBusqueda = busqueda.trim().length > 0;

  return (
    <div className="relative rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md shadow-[0_20px_80px_rgba(0,0,0,0.55)] overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-500/10 to-transparent" />

      <div className="relative px-6 py-5 border-b border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Proyectos con pedidos fechados
          </h2>

          <p className="text-sm text-white/60">
            Busca por título o solicitante, o entra por proyecto.
          </p>
        </div>

        <SearchInput
          value={busqueda}
          onChange={onBusquedaChange}
          placeholder="Buscar pedido por título o solicitante..."
          className="w-full md:w-[420px]"
        />
      </div>

      {mostrandoBusqueda ? (
        <div className="relative p-6 space-y-3">
          <div className="text-sm text-white/60">
            Mostrando{" "}
            <span className="text-white font-semibold">
              {pedidos.length}
            </span>{" "}
            de{" "}
            <span className="text-white font-semibold">
              {totalPedidos}
            </span>{" "}
            pedidos.
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full text-sm text-white/85">
              <thead className="text-left text-white/55">
                <tr className="border-b border-white/10">
                  <th className="px-6 py-4 font-semibold">Título</th>
                  <th className="px-6 py-4 font-semibold">
                    Solicitante
                  </th>
                  <th className="px-6 py-4 font-semibold">
                    Entrega propuesta
                  </th>
                  <th className="px-6 py-4 font-semibold">
                    Entrega real
                  </th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Detalles</th>
                </tr>
              </thead>

              <tbody>
                {pedidos.map((pedido) => (
                  <tr
                    key={pedido.id}
                    className="border-b border-white/10 hover:bg-white/5"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">
                        {pedido.titulo}
                      </div>

                      <div className="text-xs text-white/35">
                        ID: {pedido.id}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {pedido.nombreUsuario ||
                        pedido.correoUsuario ||
                        "Sin información"}
                    </td>

                    <td className="px-6 py-4">
                      {pedido.fechaLimite || "—"}
                    </td>

                    <td className="px-6 py-4">
                      {pedido.fechaEntregaReal || "—"}
                    </td>

                    <td className="px-6 py-4">
                      <span className={statusPillClass(pedido.status)}>
                        {statusLabel(pedido.status)}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <Link
                        href={pedidoDetailHref(pedido)}
                        className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white"
                      >
                        Ver detalles
                      </Link>
                    </td>
                  </tr>
                ))}

                {pedidos.length === 0 && (
                  <tr>
                    <td
                      className="px-6 py-10 text-center text-white/45"
                      colSpan={6}
                    >
                      No hay resultados para esa búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="relative p-6">
          {proyectos.length === 0 ? (
            <p className="text-sm text-white/60">
              Aún no hay pedidos con fecha real.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {proyectos.map(([proyecto, stats]) => (
                <ProyectoCard
                  key={proyecto}
                  proyecto={proyecto}
                  stats={stats}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}