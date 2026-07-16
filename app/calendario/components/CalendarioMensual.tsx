"use client";

import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  startOfMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import { DIAS_SEMANA } from "../constants";
import type { Pedido } from "../types";
import CalendarioHeader from "./CalendarioHeader";
import PedidoCalendarioItem from "./PedidoCalendarioItem";

type CalendarioMensualProps = {
  currentMonth: Date;
  pedidos: Pedido[];
  isAdmin: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

export default function CalendarioMensual({
  currentMonth,
  pedidos,
  isAdmin,
  onPrevMonth,
  onNextMonth,
}: CalendarioMensualProps) {
  const diasDelMes = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const primerDia = diasDelMes[0]?.getDay() ?? 0;

  const espaciosIniciales = Array.from(
    { length: primerDia },
    (_, index) => index
  );

  const mesFormateado = format(currentMonth, "MMMM yyyy", {
    locale: es,
  });

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md shadow-[0_20px_80px_rgba(0,0,0,0.55)] overflow-hidden">
      <CalendarioHeader
        mes={mesFormateado}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
      />

      <div className="p-6 overflow-x-auto">
        <div className="min-w-[850px]">
          <div className="grid grid-cols-7 gap-3 text-xs md:text-sm text-white/70 mb-3">
            {DIAS_SEMANA.map((dia) => (
              <div
                key={dia}
                className="text-center font-semibold"
              >
                {dia}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-3">
            {espaciosIniciales.map((index) => (
              <div
                key={`empty-${index}`}
                className="min-h-[140px]"
              />
            ))}

            {diasDelMes.map((dia) => {
              const pedidosDelDia = pedidos.filter((pedido) => {
                if (!pedido.fechaEntregaReal) return false;

                return isSameDay(
                  new Date(
                    `${pedido.fechaEntregaReal}T00:00:00`
                  ),
                  dia
                );
              });

              const esHoy = isSameDay(dia, new Date());

              return (
                <div
                  key={dia.toISOString()}
                  className={[
                    "min-h-[140px] rounded-2xl border bg-white/5 backdrop-blur-md p-3",
                    "hover:bg-white/10 transition",
                    esHoy
                      ? "border-teal-400/40"
                      : "border-white/10",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-semibold">
                      {format(dia, "d", { locale: es })}
                    </span>

                    {pedidosDelDia.length > 0 && (
                      <span className="text-[11px] text-white/60">
                        {pedidosDelDia.length}
                      </span>
                    )}
                  </div>

                  <div className="max-h-[92px] overflow-y-auto pr-1 space-y-1">
                    {pedidosDelDia.length === 0 ? (
                      <div className="text-xs text-white/35">
                        —
                      </div>
                    ) : (
                      pedidosDelDia.map((pedido) => (
                        <PedidoCalendarioItem
                          key={pedido.id}
                          pedido={pedido}
                          isAdmin={isAdmin}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}