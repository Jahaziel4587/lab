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
    error,
    actualizarCampo,
  } = useCalendarioPedidos();

  const [currentMonth, setCurrentMonth] = useState(
    startOfMonth(new Date())
  );

  const [busquedaFechados, setBusquedaFechados] = useState("");

  const pedidosSinFecha = useMemo(
    () =>
      pedidos.filter(
        (pedido) =>
          !pedido.fechaEntregaReal ||
          pedido.fechaEntregaReal.trim() === ""
      ),
    [pedidos]
  );

  const pedidosConFecha = useMemo(
    () =>
      pedidos.filter(
        (pedido) =>
          pedido.fechaEntregaReal &&
          pedido.fechaEntregaReal.trim() !== ""
      ),
    [pedidos]
  );

  const proyectosConFecha = useMemo(() => {
    const map = new Map<string, ProyectoStats>();

    pedidosConFecha.forEach((pedido) => {
      const status = normStatus(pedido.status);

      // Los cancelados no cuentan para el porcentaje.
      if (status === "cancelado") return;

      const proyecto = pedido.proyecto || "Sin proyecto";
      const esListo = status === "listo";

      const timestamp = pedido.fechaEntregaReal
        ? new Date(
            `${pedido.fechaEntregaReal}T00:00:00`
          ).getTime()
        : 0;

      const anterior = map.get(proyecto);

      if (!anterior) {
        map.set(proyecto, {
          total: 1,
          listos: esListo ? 1 : 0,
          ultima: timestamp,
        });

        return;
      }

      map.set(proyecto, {
        total: anterior.total + 1,
        listos: anterior.listos + (esListo ? 1 : 0),
        ultima: Math.max(anterior.ultima, timestamp),
      });
    });

    return Array.from(map.entries()).sort(([proyectoA], [proyectoB]) =>
      proyectoA.localeCompare(proyectoB)
    );
  }, [pedidosConFecha]);

  const pedidosFechadosFiltrados = useMemo(() => {
    const query = busquedaFechados.trim().toLowerCase();

    if (!query) return pedidosConFecha;

    return pedidosConFecha.filter((pedido) => {
      const titulo = String(pedido.titulo || "").toLowerCase();

      const solicitante = String(
        pedido.nombreUsuario || pedido.correoUsuario || ""
      ).toLowerCase();

      const id = String(pedido.id || "").toLowerCase();

      return (
        titulo.includes(query) ||
        solicitante.includes(query) ||
        id.includes(query)
      );
    });
  }, [pedidosConFecha, busquedaFechados]);

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
      <CalendarioMensual
        currentMonth={currentMonth}
        pedidos={pedidosConFecha}
        isAdmin={Boolean(isAdmin)}
        onPrevMonth={() =>
          setCurrentMonth((month) => addMonths(month, -1))
        }
        onNextMonth={() =>
          setCurrentMonth((month) => addMonths(month, 1))
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