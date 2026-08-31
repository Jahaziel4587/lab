"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
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
  const [selectedDay, setSelectedDay] =
    useState<Date>(() => {
      const hoy = new Date();

      return isSameMonth(hoy, currentMonth)
        ? hoy
        : startOfMonth(currentMonth);
    });

  const diasDelMes = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
      }),
    [currentMonth],
  );

  const primerDia =
    diasDelMes[0]?.getDay() ?? 0;

  const espaciosIniciales = Array.from(
    { length: primerDia },
    (_, index) => index,
  );

  const mesFormateado = format(
    currentMonth,
    "MMMM yyyy",
    {
      locale: es,
    },
  );

  /*
   * Agrupamos una sola vez los pedidos por fecha.
   * Esto evita recorrer toda la lista por cada casilla.
   */
  const pedidosPorFecha = useMemo(() => {
    const resultado = new Map<string, Pedido[]>();

    pedidos.forEach((pedido) => {
      const fecha =
        pedido.fechaEntregaReal?.trim();

      if (!fecha) {
        return;
      }

      const existentes =
        resultado.get(fecha) ?? [];

      existentes.push(pedido);
      resultado.set(fecha, existentes);
    });

    return resultado;
  }, [pedidos]);

  useEffect(() => {
    const hoy = new Date();

    setSelectedDay(
      isSameMonth(hoy, currentMonth)
        ? hoy
        : startOfMonth(currentMonth),
    );
  }, [currentMonth]);

  const selectedDayKey = format(
    selectedDay,
    "yyyy-MM-dd",
  );

  const pedidosDelDiaSeleccionado =
    pedidosPorFecha.get(selectedDayKey) ?? [];

  return (
    <div
      className="overflow-hidden rounded-2xl
        border border-white/10 bg-black/40
        shadow-[0_20px_80px_rgba(0,0,0,0.55)]
        backdrop-blur-md"
    >
      <CalendarioHeader
        mes={mesFormateado}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
      />

      {/* Vista para teléfono */}
      <div className="p-3 sm:p-4 md:hidden">
        <div
          className="mb-2 grid grid-cols-7
            gap-1 text-[10px] text-white/55"
        >
          {DIAS_SEMANA.map((dia) => (
            <div
              key={dia}
              className="py-1 text-center font-semibold"
            >
              {dia.substring(0, 1)}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {espaciosIniciales.map((index) => (
            <div
              key={`mobile-empty-${index}`}
              aria-hidden="true"
              className="aspect-square"
            />
          ))}

          {diasDelMes.map((dia) => {
            const fechaKey = format(
              dia,
              "yyyy-MM-dd",
            );

            const pedidosDelDia =
              pedidosPorFecha.get(fechaKey) ?? [];

            const esHoy = isSameDay(
              dia,
              new Date(),
            );

            const estaSeleccionado =
              isSameDay(dia, selectedDay);

            return (
              <button
                type="button"
                key={dia.toISOString()}
                onClick={() =>
                  setSelectedDay(dia)
                }
                aria-label={`${format(
                  dia,
                  "d 'de' MMMM",
                  { locale: es },
                )}. ${pedidosDelDia.length} pedidos`}
                className={[
                  "relative flex aspect-square min-h-11",
                  "flex-col items-center justify-center",
                  "rounded-xl border text-sm transition",
                  estaSeleccionado
                    ? "border-emerald-400/70 bg-emerald-400/15 text-emerald-100"
                    : esHoy
                      ? "border-teal-400/40 bg-white/[0.06] text-white"
                      : "border-white/10 bg-white/[0.035] text-white/80",
                ].join(" ")}
              >
                <span className="font-semibold">
                  {format(dia, "d")}
                </span>

                {pedidosDelDia.length > 0 && (
                  <>
                    <span
                      className="absolute right-1 top-1
                        flex h-4 min-w-4 items-center
                        justify-center rounded-full
                        bg-emerald-400 px-1
                        text-[9px] font-bold text-black"
                    >
                      {pedidosDelDia.length > 9
                        ? "9+"
                        : pedidosDelDia.length}
                    </span>

                    <span
                      className="mt-0.5 h-1 w-1
                        rounded-full bg-emerald-300"
                    />
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Pedidos del día seleccionado */}
        <div
          className="mt-4 rounded-2xl border
            border-white/10 bg-white/[0.035] p-4"
        >
          <div
            className="flex items-center
              justify-between gap-3"
          >
            <div>
              <p
                className="text-xs font-medium
                  capitalize text-white/55"
              >
                Día seleccionado
              </p>

              <h2
                className="text-sm font-semibold
                  capitalize text-white"
              >
                {format(
                  selectedDay,
                  "EEEE d 'de' MMMM",
                  { locale: es },
                )}
              </h2>
            </div>

            <span
              className="shrink-0 rounded-full
                border border-white/10 bg-white/5
                px-3 py-1 text-xs text-white/70"
            >
              {pedidosDelDiaSeleccionado.length}{" "}
              {pedidosDelDiaSeleccionado.length === 1
                ? "pedido"
                : "pedidos"}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {pedidosDelDiaSeleccionado.length === 0 ? (
              <div
                className="rounded-xl border
                  border-dashed border-white/10
                  px-4 py-5 text-center
                  text-sm text-white/40"
              >
                No hay pedidos programados para este día.
              </div>
            ) : (
              pedidosDelDiaSeleccionado.map(
                (pedido) => (
                  <div
                    key={pedido.id}
                    className="rounded-xl border
                      border-white/10 bg-black/20 p-3"
                  >
                    <PedidoCalendarioItem
                      pedido={pedido}
                      isAdmin={isAdmin}
                    />

                    <div
                      className="mt-2 flex items-center
                        justify-between gap-3
                        text-[11px] text-white/50"
                    >
                      <span className="truncate">
                        {pedido.proyecto ||
                          "Sin proyecto"}
                      </span>

                      {pedido.esEjecucion && (
                        <span
                          className="shrink-0
                            text-emerald-300/70"
                        >
                          Repetición
                        </span>
                      )}
                    </div>
                  </div>
                ),
              )
            )}
          </div>
        </div>
      </div>

      {/* Vista para computadora y tablet grande */}
      <div
        className="hidden overflow-x-auto
          p-6 md:block"
      >
        <div className="min-w-[850px]">
          <div
            className="mb-3 grid grid-cols-7
              gap-3 text-xs text-white/70
              md:text-sm"
          >
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
                key={`desktop-empty-${index}`}
                className="min-h-[140px]"
              />
            ))}

            {diasDelMes.map((dia) => {
              const fechaKey = format(
                dia,
                "yyyy-MM-dd",
              );

              const pedidosDelDia =
                pedidosPorFecha.get(fechaKey) ?? [];

              const esHoy = isSameDay(
                dia,
                new Date(),
              );

              return (
                <div
                  key={dia.toISOString()}
                  className={[
                    "min-h-[140px] rounded-2xl",
                    "border bg-white/5 p-3",
                    "backdrop-blur-md transition",
                    "hover:bg-white/10",
                    esHoy
                      ? "border-teal-400/40"
                      : "border-white/10",
                  ].join(" ")}
                >
                  <div
                    className="mb-2 flex items-center
                      justify-between"
                  >
                    <span
                      className="font-semibold
                        text-white"
                    >
                      {format(dia, "d", {
                        locale: es,
                      })}
                    </span>

                    {pedidosDelDia.length > 0 && (
                      <span
                        className="text-[11px]
                          text-white/60"
                      >
                        {pedidosDelDia.length}
                      </span>
                    )}
                  </div>

                  <div
                    className="max-h-[92px]
                      space-y-1 overflow-y-auto pr-1"
                  >
                    {pedidosDelDia.length === 0 ? (
                      <div className="text-xs text-white/35">
                        —
                      </div>
                    ) : (
                      pedidosDelDia.map(
                        (pedido) => (
                          <PedidoCalendarioItem
                            key={pedido.id}
                            pedido={pedido}
                            isAdmin={isAdmin}
                          />
                        ),
                      )
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