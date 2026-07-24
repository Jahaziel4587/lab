"use client";

import {
  cardClass,
  cardPad,
  statusLabel,
  statusPillClass,
} from "../styles";
import { EjecucionPedido } from "../types";

export type EjecucionCotizable = {
  id: string | null;
  numero: number;
  tipo: "original" | "repeticion";
  titulo: string;
  fechaLimite?: string;
  fechaEntregaReal?: string;
  status?: string;
};

type Props = {
  pedido: any;
  ejecuciones: EjecucionPedido[];
  loading: boolean;

  ejecucionSeleccionadaId?: string | null;

  onCotizarEjecucion: (
    ejecucion: EjecucionCotizable
  ) => void;
};

export default function EjecucionesCard({
  pedido,
  ejecuciones,
  loading,
  ejecucionSeleccionadaId,
  onCotizarEjecucion,
}: Props) {
  const originalSeleccionada =
    ejecucionSeleccionadaId === null ||
    ejecucionSeleccionadaId === undefined;

  const seleccionarOriginal = () => {
    onCotizarEjecucion({
      id: null,
      numero: 1,
      tipo: "original",
      titulo: pedido?.titulo || "Sin título",
      fechaLimite: pedido?.fechaLimite || "",
      fechaEntregaReal: pedido?.fechaEntregaReal || "",
      status: pedido?.status || "en proceso",
    });
  };

  return (
    <div className={`mt-6 ${cardClass} ${cardPad}`}>
      <div>
        <h2 className="text-lg font-semibold text-white/90">
          Ejecuciones del pedido
        </h2>

        <p className="mt-1 text-sm text-white/60">
          Cada ejecución representa una vez que el laboratorio realiza este
          mismo pedido.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {/* EJECUCIÓN ORIGINAL */}
        <div
          className={[
            "rounded-2xl border p-4 transition",
            originalSeleccionada
              ? "border-emerald-400/30 bg-emerald-500/[0.08]"
              : "border-white/10 bg-white/[0.04]",
          ].join(" ")}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="font-semibold text-white/90">
                Ejecución 1 · Original
              </div>

              <div className="mt-1 text-sm text-white/60">
                Fecha propuesta: {pedido?.fechaLimite || "—"} · Entrega real:{" "}
                {pedido?.fechaEntregaReal || "Pendiente"}
              </div>

              <div className="mt-1 text-xs text-white/45">
                Solicitado por:{" "}
                {pedido?.nombreUsuario ||
                  pedido?.correoUsuario ||
                  pedido?.usuario ||
                  "—"}
              </div>

              {originalSeleccionada && (
                <div className="mt-2 text-xs font-medium text-emerald-300">
                  Cotización seleccionada
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <span
                className={statusPillClass(
                  pedido?.status || "en proceso"
                )}
              >
                {statusLabel(
                  pedido?.status || "en proceso"
                )}
              </span>

              <button
                type="button"
                onClick={seleccionarOriginal}
                className={[
                  "inline-flex items-center justify-center rounded-xl border px-4 py-2",
                  "text-sm font-medium transition",
                  originalSeleccionada
                    ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                    : "border-white/10 bg-white/[0.06] text-white/85 hover:bg-white/[0.10]",
                ].join(" ")}
              >
                {originalSeleccionada
                  ? "Cotizando original"
                  : "Cotizar original"}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-white/60">
            Cargando ejecuciones…
          </p>
        ) : ejecuciones.length === 0 ? (
          <p className="text-sm text-white/60 italic">
            Este pedido aún no tiene repeticiones.
          </p>
        ) : (
          ejecuciones.map((ejecucion) => {
            const seleccionada =
              ejecucionSeleccionadaId === ejecucion.id;

            return (
              <div
                key={ejecucion.id}
                className={[
                  "rounded-2xl border p-4 transition",
                  seleccionada
                    ? "border-emerald-400/30 bg-emerald-500/[0.08]"
                    : "border-white/10 bg-white/[0.04]",
                ].join(" ")}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold text-white/90">
                      Ejecución {ejecucion.numero} · Repetición
                    </div>

                    <div className="mt-1 text-sm text-white/60">
                      Fecha propuesta:{" "}
                      {ejecucion.fechaLimite || "—"} · Entrega real:{" "}
                      {ejecucion.fechaEntregaReal || "Pendiente"}
                    </div>

                    <div className="mt-1 text-xs text-white/45">
                      Solicitado por:{" "}
                      {ejecucion.solicitadoPorNombre ||
                        ejecucion.solicitadoPorEmail ||
                        "—"}
                    </div>

                    {ejecucion.notas && (
                      <div className="mt-2 whitespace-pre-wrap text-sm text-white/70">
                        {ejecucion.notas}
                      </div>
                    )}

                    {seleccionada && (
                      <div className="mt-2 text-xs font-medium text-emerald-300">
                        Cotización seleccionada
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    <span
                      className={statusPillClass(
                        ejecucion.status || "en proceso"
                      )}
                    >
                      {statusLabel(
                        ejecucion.status || "en proceso"
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        onCotizarEjecucion({
                          id: ejecucion.id,
                          numero: ejecucion.numero,
                          tipo: "repeticion",
                          titulo:
                            ejecucion.titulo ||
                            `${pedido?.titulo || "Sin título"} (${
                              ejecucion.numero
                            })`,
                          fechaLimite:
                            ejecucion.fechaLimite || "",
                          fechaEntregaReal:
                            ejecucion.fechaEntregaReal || "",
                          status:
                            ejecucion.status || "en proceso",
                        })
                      }
                      className={[
                        "inline-flex items-center justify-center rounded-xl border px-4 py-2",
                        "text-sm font-medium transition",
                        seleccionada
                          ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                          : "border-white/10 bg-white/[0.06] text-white/85 hover:bg-white/[0.10]",
                      ].join(" ")}
                    >
                      {seleccionada
                        ? `Cotizando ejecución ${ejecucion.numero}`
                        : `Cotizar ejecución ${ejecucion.numero}`}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}