"use client";

import { useMemo, useState } from "react";
import { addMonths, startOfMonth } from "date-fns";
import { useAuth } from "@/src/Context/AuthContext";

import CalendarioMensual from "./components/CalendarioMensual";
import PedidosPendientesTable from "./components/PedidosPendientesTable";
import ProyectosFechados from "./components/ProyectosFechados";

import { useCalendarioPedidos } from "./hooks/useCalendarioPedidos";
import type { ProyectoStats } from "./types";
import { normStatus } from "./utils";

export default function CalendarioPage() {
  const { isAdmin } = useAuth();

  const {
    pedidos,
    cargando,
    cargandoEjecuciones,
    error,
    actualizarCampo,
  } = useCalendarioPedidos();

  const [currentMonth, setCurrentMonth] = useState<Date>(
    startOfMonth(new Date())
  );

  const [busquedaFechados, setBusquedaFechados] = useState("");

  const pedidosSinFecha = useMemo(() => {
    return pedidos.filter(
      (pedido) =>
        !pedido.fechaEntregaReal ||
        pedido.fechaEntregaReal.trim() === ""
    );
  }, [pedidos]);

  const pedidosConFecha = useMemo(() => {
    return pedidos.filter(
      (pedido) =>
        pedido.fechaEntregaReal &&
        pedido.fechaEntregaReal.trim() !== ""
    );
  }, [pedidos]);

  const proyectosConFecha = useMemo(() => {
    const proyectosMap = new Map<string, ProyectoStats>();

    pedidosConFecha.forEach((pedido) => {
      const status = normStatus(pedido.status);

      // Los cancelados no cuentan para el porcentaje del proyecto.
      if (status === "cancelado") return;

      const proyecto = pedido.proyecto || "Sin proyecto";
      const esListo = status === "listo";

      const fechaTimestamp = pedido.fechaEntregaReal
        ? new Date(
            `${pedido.fechaEntregaReal}T00:00:00`
          ).getTime()
        : 0;

      const statsActuales = proyectosMap.get(proyecto);

      if (!statsActuales) {
        proyectosMap.set(proyecto, {
          total: 1,
          listos: esListo ? 1 : 0,
          ultima: fechaTimestamp,
        });

        return;
      }

      proyectosMap.set(proyecto, {
        total: statsActuales.total + 1,
        listos:
          statsActuales.listos +
          (esListo ? 1 : 0),
        ultima: Math.max(
          statsActuales.ultima,
          fechaTimestamp
        ),
      });
    });

    return Array.from(proyectosMap.entries()).sort(
      ([proyectoA], [proyectoB]) =>
        proyectoA.localeCompare(proyectoB)
    );
  }, [pedidosConFecha]);

  const pedidosFechadosFiltrados = useMemo(() => {
    const query = busquedaFechados
      .trim()
      .toLowerCase();

    if (!query) {
      return pedidosConFecha;
    }

    return pedidosConFecha.filter((pedido) => {
      const titulo = String(
        pedido.titulo || ""
      ).toLowerCase();

      const solicitante = String(
        pedido.nombreUsuario ||
          pedido.correoUsuario ||
          ""
      ).toLowerCase();

      const id = String(
        pedido.id || ""
      ).toLowerCase();

      const proyecto = String(
        pedido.proyecto || ""
      ).toLowerCase();

      return (
        titulo.includes(query) ||
        solicitante.includes(query) ||
        id.includes(query) ||
        proyecto.includes(query)
      );
    });
  }, [
    pedidosConFecha,
    busquedaFechados,
  ]);

  if (cargando) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-10 text-center text-white/60">
          Cargando calendario...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-6 text-red-200">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-10">
      {cargandoEjecuciones && (
        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.06] px-4 py-3 text-sm text-emerald-100/80">
          Cargando repeticiones de pedidos...
        </div>
      )}

      <CalendarioMensual
        currentMonth={currentMonth}
        pedidos={pedidosConFecha}
        isAdmin={Boolean(isAdmin)}
        onPrevMonth={() =>
          setCurrentMonth((month) =>
            addMonths(month, -1)
          )
        }
        onNextMonth={() =>
          setCurrentMonth((month) =>
            addMonths(month, 1)
          )
        }
      />

      {isAdmin && (
        <PedidosPendientesTable
          pedidos={pedidosSinFecha}
          onActualizarCampo={actualizarCampo}
        />
      )}

      {isAdmin && (
        <ProyectosFechados
          proyectos={proyectosConFecha}
          pedidos={pedidosFechadosFiltrados}
          totalPedidos={pedidosConFecha.length}
          busqueda={busquedaFechados}
          onBusquedaChange={setBusquedaFechados}
        />
      )}
    </div>
  );
}