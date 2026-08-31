"use client";

import Link from "next/link";
import type { Pedido } from "../types";
import { pedidoDetailHref } from "../utils";
import StatusSelect from "./StatusSelect";
import { FiCalendar } from "react-icons/fi";

type PedidosPendientesTableProps = {
  pedidos: Pedido[];
  onActualizarCampo: (
    pedido: Pedido,
    campo: string,
    valor: string,
  ) => Promise<void>;
};

export default function PedidosPendientesTable({
  pedidos,
  onActualizarCampo,
}: PedidosPendientesTableProps) {
  return (
    <section className="space-y-4">
      {/* Encabezado */}
      <div
        className="flex flex-col gap-2
          sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h2
            className="text-lg font-semibold
              text-white sm:text-xl"
          >
            Pedidos pendientes de fecha
          </h2>

          <p className="mt-1 text-sm text-white/60">
            Asigna la fecha real y ajusta el status.
          </p>
        </div>

        <div className="text-sm text-white/60">
          Mostrando{" "}
          <span className="font-semibold text-white">
            {pedidos.length}
          </span>
        </div>
      </div>

      {/* Vista móvil */}
      <div className="space-y-3 md:hidden">
        {pedidos.length === 0 ? (
          <div
            className="rounded-2xl border
              border-white/10 bg-white/[0.035]
              px-4 py-10 text-center
              text-sm text-white/45"
          >
            No hay pedidos pendientes de asignar fecha.
          </div>
        ) : (
          pedidos.map((pedido) => (
            <article
              key={pedido.id}
              className="relative overflow-hidden
                rounded-2xl border border-white/10
                bg-white/[0.035] p-4
                backdrop-blur-xl"
            >
              <div
                className="pointer-events-none absolute
                  inset-x-0 top-0 h-20
                  bg-gradient-to-b
                  from-emerald-500/10 to-transparent"
              />

              <div className="relative">
                {/* Título */}
                <div>
                  <h3
                    className="break-words text-base
                      font-semibold leading-snug
                      text-white/90"
                  >
                    {pedido.titulo}
                  </h3>

                  <p
                    className="mt-1 break-all
                      text-[10px] text-white/35"
                  >
                    ID: {pedido.id}
                  </p>

                  {pedido.esEjecucion && (
                    <span
                      className="mt-2 inline-flex
                        rounded-full border
                        border-emerald-400/20
                        bg-emerald-400/10 px-2.5
                        py-1 text-[10px]
                        text-emerald-300"
                    >
                      Repetición del pedido
                    </span>
                  )}
                </div>

                {/* Información */}
                <dl
                  className="mt-4 grid grid-cols-2
                    gap-3 rounded-xl border
                    border-white/10 bg-black/20 p-3"
                >
                  <div className="min-w-0">
                    <dt
                      className="text-[11px]
                        text-white/45"
                    >
                      Solicitante
                    </dt>

                    <dd
                      className="mt-0.5 truncate
                        text-sm text-white/80"
                      title={
                        pedido.nombreUsuario ||
                        pedido.correoUsuario ||
                        "Sin información"
                      }
                    >
                      {pedido.nombreUsuario ||
                        pedido.correoUsuario ||
                        "Sin información"}
                    </dd>
                  </div>

                  <div className="min-w-0">
                    <dt
                      className="text-[11px]
                        text-white/45"
                    >
                      Entrega propuesta
                    </dt>

                    <dd
                      className="mt-0.5 text-sm
                        text-white/80"
                    >
                      {pedido.fechaLimite || "—"}
                    </dd>
                  </div>
                </dl>

                {/* Fecha real */}
                <div className="mt-4">
  <p className="text-xs font-medium text-white/60">
    Fecha de entrega real
  </p>

  <div className="relative mt-2">
    {/* Apariencia visible del selector */}
    <div
      className="flex min-h-12 w-full items-center
        justify-between gap-3 rounded-xl border
        border-white/10 bg-white/[0.05]
        px-4 py-3 text-sm text-white/85"
    >
      <span>
        {pedido.fechaEntregaReal
          ? pedido.fechaEntregaReal
              .split("-")
              .reverse()
              .join("/")
          : "Seleccionar fecha"}
      </span>

      <FiCalendar
        aria-hidden="true"
        className="shrink-0 text-lg text-white/60"
      />
    </div>

    {/* Selector nativo invisible de iOS */}
    <input
      id={`fecha-real-${pedido.id}`}
      type="date"
      value={pedido.fechaEntregaReal || ""}
      aria-label={`Seleccionar fecha para ${pedido.titulo}`}
      onChange={(event) => {
        void onActualizarCampo(
          pedido,
          "fechaEntregaReal",
          event.target.value,
        );
      }}
      className="absolute inset-0 h-full w-full
        cursor-pointer opacity-0"
    />
  </div>
</div>

                {/* Status */}
                <div className="mt-4">
                  <p
                    className="mb-2 text-xs
                      font-medium text-white/60"
                  >
                    Status
                  </p>

                  <StatusSelect
                    value={pedido.status}
                    onChange={(value) => {
                      void onActualizarCampo(
                        pedido,
                        "status",
                        value,
                      );
                    }}
                  />
                </div>

                {/* Detalles */}
                <Link
                  href={pedidoDetailHref(pedido)}
                  className="mt-4 flex min-h-12
                    w-full items-center justify-center
                    rounded-xl border border-white/10
                    bg-white/[0.06] px-4 py-2
                    text-sm font-medium text-white/90
                    transition hover:bg-white/[0.1]"
                >
                  Ver detalles
                </Link>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Vista de computadora */}
      <div
        className="relative hidden overflow-hidden
          rounded-3xl border border-white/10
          bg-white/[0.035] backdrop-blur-2xl
          ring-1 ring-white/5
          shadow-[0_30px_120px_-80px_rgba(0,0,0,0.95)]
          md:block"
      >
        <div
          className="pointer-events-none absolute
            inset-x-0 top-0 h-24
            bg-gradient-to-b
            from-emerald-500/10 to-transparent"
        />

        <div className="relative overflow-x-auto">
          <table
            className="w-full min-w-[1120px]
              table-fixed"
          >
            <colgroup>
              <col className="w-[320px]" />
              <col className="w-[170px]" />
              <col className="w-[150px]" />
              <col className="w-[170px]" />
              <col className="w-[150px]" />
              <col className="w-[160px]" />
            </colgroup>

            <thead className="bg-white/[0.02]">
              <tr
                className="text-left text-[12px]
                  tracking-wide text-white/55"
              >
                <th className="px-4 py-3 font-semibold">
                  Título
                </th>

                <th className="px-4 py-3 font-semibold">
                  Solicitante
                </th>

                <th className="px-4 py-3 font-semibold">
                  Entrega propuesta
                </th>

                <th className="px-4 py-3 font-semibold">
                  Entrega real
                </th>

                <th className="px-4 py-3 font-semibold">
                  Status
                </th>

                <th className="px-4 py-3 font-semibold">
                  Detalles
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {pedidos.map((pedido) => (
                <tr
                  key={pedido.id}
                  className="align-top transition
                    hover:bg-emerald-500/[0.04]"
                >
                  <td className="px-4 py-2.5">
                    <div
                      className="max-w-[340px]
                        whitespace-normal break-words
                        font-medium leading-snug
                        text-white/90"
                      title={pedido.titulo}
                    >
                      {pedido.titulo}
                    </div>

                    <div
                      className="mt-1 text-[10px]
                        text-white/35"
                    >
                      ID:{" "}
                      <span className="break-all">
                        {pedido.id}
                      </span>
                    </div>

                    {pedido.esEjecucion && (
                      <div
                        className="mt-1 text-[10px]
                          text-emerald-300/70"
                      >
                        Repetición del pedido
                      </div>
                    )}
                  </td>

                  <td
                    className="px-4 py-2.5
                      text-white/75"
                  >
                    {pedido.nombreUsuario ||
                      pedido.correoUsuario ||
                      "Sin información"}
                  </td>

                  <td
                    className="px-4 py-2.5
                      text-white/75"
                  >
                    {pedido.fechaLimite || "—"}
                  </td>

                  <td className="px-4 py-2.5">
                    <input
                      type="date"
                      value={
                        pedido.fechaEntregaReal || ""
                      }
                      onChange={(event) => {
                        void onActualizarCampo(
                          pedido,
                          "fechaEntregaReal",
                          event.target.value,
                        );
                      }}
                      className="w-[140px] rounded-2xl
                        border border-white/10
                        bg-white/[0.05] px-3 py-2
                        text-sm text-white
                        focus:outline-none focus:ring-2
                        focus:ring-emerald-400/25
                        [color-scheme:dark]"
                    />
                  </td>

                  <td className="px-4 py-2.5">
                    <StatusSelect
                      value={pedido.status}
                      onChange={(value) => {
                        void onActualizarCampo(
                          pedido,
                          "status",
                          value,
                        );
                      }}
                    />
                  </td>

                  <td className="px-4 py-2.5">
                    <Link
                      href={pedidoDetailHref(pedido)}
                      className="inline-flex items-center
                        justify-center rounded-2xl
                        border border-white/10
                        bg-white/[0.05] px-4 py-2
                        text-white/85 transition
                        hover:bg-white/[0.08]"
                    >
                      Ver detalles
                    </Link>
                  </td>
                </tr>
              ))}

              {pedidos.length === 0 && (
                <tr>
                  <td
                    className="px-4 py-10
                      text-center text-white/45"
                    colSpan={6}
                  >
                    No hay pedidos pendientes de
                    asignar fecha.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}