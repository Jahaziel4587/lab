"use client";

import { cardClass, cardPad, statusLabel, statusPillClass } from "../styles";
import { EjecucionPedido } from "../types";

type Props = {
  pedido: any;
  ejecuciones: EjecucionPedido[];
  loading: boolean;
};

export default function EjecucionesCard({
  pedido,
  ejecuciones,
  loading,
}: Props) {
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
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-white/90">
                Ejecución 1 · Original
              </div>

              <div className="text-sm text-white/60 mt-1">
                Fecha propuesta: {pedido?.fechaLimite || "—"} · Entrega real:{" "}
                {pedido?.fechaEntregaReal || "Pendiente"}
              </div>

              <div className="text-xs text-white/45 mt-1">
                Solicitado por:{" "}
                {pedido?.nombreUsuario ||
                  pedido?.correoUsuario ||
                  pedido?.usuario ||
                  "—"}
              </div>
            </div>

            <span className={statusPillClass(pedido?.status || "en proceso")}>
              {statusLabel(pedido?.status || "en proceso")}
            </span>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-white/60">Cargando ejecuciones…</p>
        ) : ejecuciones.length === 0 ? (
          <p className="text-sm text-white/60 italic">
            Este pedido aún no tiene repeticiones.
          </p>
        ) : (
          ejecuciones.map((e) => (
            <div
              key={e.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-white/90">
                    Ejecución {e.numero} · Repetición
                  </div>

                  <div className="text-sm text-white/60 mt-1">
                    Fecha propuesta: {e.fechaLimite || "—"} · Entrega real:{" "}
                    {e.fechaEntregaReal || "Pendiente"}
                  </div>

                  <div className="text-xs text-white/45 mt-1">
                    Solicitado por:{" "}
                    {e.solicitadoPorNombre || e.solicitadoPorEmail || "—"}
                  </div>

                  {e.notas && (
                    <div className="mt-2 text-sm text-white/70 whitespace-pre-wrap">
                      {e.notas}
                    </div>
                  )}
                </div>

                <span className={statusPillClass(e.status || "en proceso")}>
                  {statusLabel(e.status || "en proceso")}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}