"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Pedido } from "../types";
import { pedidoDetailHref } from "../utils";
import StatusSelect from "./StatusSelect";
import { FiCalendar, FiX } from "react-icons/fi";

type PedidosPendientesTableProps = {
  pedidos: Pedido[];
  onActualizarCampo: (
    pedido: Pedido,
    campo: string,
    valor: string,
  ) => Promise<void>;
};

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export default function PedidosPendientesTable({
  pedidos,
  onActualizarCampo,
}: PedidosPendientesTableProps) {
  const [pedidoFecha, setPedidoFecha] = useState<Pedido | null>(null);
  const [dia, setDia] = useState("");
  const [mes, setMes] = useState("");
  const [anio, setAnio] = useState("");

  const anioActual = new Date().getFullYear();
  const anios = useMemo(
    () => Array.from({ length: 8 }, (_, index) => anioActual - 2 + index),
    [anioActual],
  );

  const diasDelMes = useMemo(() => {
    if (!mes || !anio) return 31;
    return new Date(Number(anio), Number(mes), 0).getDate();
  }, [mes, anio]);

  const abrirSelectorFecha = (pedido: Pedido) => {
    setPedidoFecha(pedido);

    if (pedido.fechaEntregaReal) {
      const [year, month, day] = pedido.fechaEntregaReal.split("-");
      setAnio(year || "");
      setMes(month || "");
      setDia(day || "");
    } else {
      setAnio("");
      setMes("");
      setDia("");
    }
  };

  const cerrarSelectorFecha = () => {
    setPedidoFecha(null);
    setDia("");
    setMes("");
    setAnio("");
  };

  const confirmarFecha = () => {
    if (!pedidoFecha || !dia || !mes || !anio) return;

    const fecha = `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
    void onActualizarCampo(pedidoFecha, "fechaEntregaReal", fecha);
    cerrarSelectorFecha();
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white sm:text-xl">
            Pedidos pendientes de fecha
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Asigna la fecha real y ajusta el status.
          </p>
        </div>

        <div className="text-sm text-white/60">
          Mostrando <span className="font-semibold text-white">{pedidos.length}</span>
        </div>
      </div>

      {/* Móvil */}
      <div className="space-y-2 md:hidden">
        {pedidos.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-10 text-center text-sm text-white/45">
            No hay pedidos pendientes de asignar fecha.
          </div>
        ) : (
          pedidos.map((pedido) => (
            <article
              key={pedido.id}
              className="rounded-2xl border border-white/10 bg-white/[0.035] px-3.5 py-3"
            >
              <Link
                href={pedidoDetailHref(pedido)}
                className="block break-words text-[15px] font-semibold leading-snug text-emerald-100 active:text-emerald-300"
              >
                {pedido.titulo || "Sin título"}
              </Link>

              <p className="mt-1 truncate text-xs text-white/50">
                {pedido.nombreUsuario || pedido.correoUsuario || "Sin información"}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => abrirSelectorFecha(pedido)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/75 transition active:bg-white/[0.12]"
                  aria-label={`Seleccionar fecha para ${pedido.titulo}`}
                  title="Seleccionar fecha"
                >
                  <FiCalendar aria-hidden="true" className="text-lg" />
                </button>

                <div className="min-w-0 flex-1">
                  <StatusSelect
                    value={pedido.status}
                    onChange={(value) => {
                      void onActualizarCampo(pedido, "status", value);
                    }}
                  />
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Selector de fecha propio para móvil: nunca guarda hasta Confirmar. */}
      {pedidoFecha && (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/70 p-3 md:hidden">
          <div className="w-full rounded-3xl border border-white/10 bg-neutral-950 p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.16em] text-white/40">
                  Fecha de entrega real
                </p>
                <h3 className="mt-1 truncate text-base font-semibold text-white/90">
                  {pedidoFecha.titulo || "Sin título"}
                </h3>
              </div>

              <button
                type="button"
                onClick={cerrarSelectorFecha}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70"
                aria-label="Cerrar selector de fecha"
              >
                <FiX />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div>
                <label className="mb-1.5 block text-xs text-white/50">Día</label>
                <select
                  value={dia}
                  onChange={(event) => setDia(event.target.value)}
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-2 text-base text-white outline-none [&>option]:bg-neutral-900"
                >
                  <option value="">—</option>
                  {Array.from({ length: diasDelMes }, (_, index) => index + 1).map(
                    (value) => (
                      <option key={value} value={String(value)}>
                        {value}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-white/50">Mes</label>
                <select
                  value={mes}
                  onChange={(event) => {
                    const nuevoMes = event.target.value;
                    setMes(nuevoMes);
                    if (dia && anio && nuevoMes) {
                      const max = new Date(Number(anio), Number(nuevoMes), 0).getDate();
                      if (Number(dia) > max) setDia("");
                    }
                  }}
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-2 text-sm text-white outline-none [&>option]:bg-neutral-900"
                >
                  <option value="">—</option>
                  {MESES.map((nombre, index) => (
                    <option key={nombre} value={String(index + 1)}>
                      {nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-white/50">Año</label>
                <select
                  value={anio}
                  onChange={(event) => setAnio(event.target.value)}
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-2 text-base text-white outline-none [&>option]:bg-neutral-900"
                >
                  <option value="">—</option>
                  {anios.map((value) => (
                    <option key={value} value={String(value)}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={cerrarSelectorFecha}
                className="min-h-12 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/75"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarFecha}
                disabled={!dia || !mes || !anio}
                className="min-h-12 flex-1 rounded-xl border border-emerald-400/25 bg-emerald-500/15 px-4 text-sm font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-35"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vista de computadora: se conserva completa. */}
      <div className="relative hidden overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-2xl ring-1 ring-white/5 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.95)] md:block">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-500/10 to-transparent" />

        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[1120px] table-fixed">
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
                <th className="px-4 py-3 font-semibold">Título</th>
                <th className="px-4 py-3 font-semibold">Solicitante</th>
                <th className="px-4 py-3 font-semibold">Entrega propuesta</th>
                <th className="px-4 py-3 font-semibold">Entrega real</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Detalles</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {pedidos.map((pedido) => (
                <tr
                  key={pedido.id}
                  className="align-top transition hover:bg-emerald-500/[0.04]"
                >
                  <td className="px-4 py-2.5">
                    <div
                      className="max-w-[340px] whitespace-normal break-words font-medium leading-snug text-white/90"
                      title={pedido.titulo}
                    >
                      {pedido.titulo}
                    </div>
                    <div className="mt-1 text-[10px] text-white/35">
                      ID: <span className="break-all">{pedido.id}</span>
                    </div>
                    {pedido.esEjecucion && (
                      <div className="mt-1 text-[10px] text-emerald-300/70">
                        Repetición del pedido
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-2.5 text-white/75">
                    {pedido.nombreUsuario || pedido.correoUsuario || "Sin información"}
                  </td>

                  <td className="px-4 py-2.5 text-white/75">
                    {pedido.fechaLimite || "—"}
                  </td>

                  <td className="px-4 py-2.5">
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
                  </td>

                  <td className="px-4 py-2.5">
                    <StatusSelect
                      value={pedido.status}
                      onChange={(value) => {
                        void onActualizarCampo(pedido, "status", value);
                      }}
                    />
                  </td>

                  <td className="px-4 py-2.5">
                    <Link
                      href={pedidoDetailHref(pedido)}
                      className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-white/85 transition hover:bg-white/[0.08]"
                    >
                      Ver detalles
                    </Link>
                  </td>
                </tr>
              ))}

              {pedidos.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-white/45" colSpan={6}>
                    No hay pedidos pendientes de asignar fecha.
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
