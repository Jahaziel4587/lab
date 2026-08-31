"use client";

import { useMemo, useState } from "react";
import { addMonths, startOfMonth } from "date-fns";
import { useAuth } from "@/src/Context/AuthContext";
import Link from "next/link";
import CalendarioMensual from "./components/CalendarioMensual";
import PedidosPendientesTable from "./components/PedidosPendientesTable";
import ProyectosFechados from "./components/ProyectosFechados";

import { useCalendarioPedidos } from "./hooks/useCalendarioPedidos";
import type { ProyectoStats } from "./types";
import { normStatus } from "./utils";

export default function CalendarioPage() {
  const {
  user,
  isAdmin,
  loading: authLoading,
} = useAuth();

  const {
    pedidos,
    cargando,
    cargandoEjecuciones,
    error,
    actualizarCampo,
 } = useCalendarioPedidos(Boolean(user));

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
if (authLoading) {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <div
        className="rounded-2xl border border-white/10
          bg-black/40 p-10 text-center text-white/60"
      >
        Verificando sesión...
      </div>
    </div>
  );
}

if (!user) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div
        className="rounded-3xl border border-white/10
          bg-black/50 p-8 text-center text-white
          backdrop-blur-xl"
      >
        <h1 className="text-xl font-semibold">
          Inicia sesión para consultar el calendario
        </h1>

        <p className="mt-2 text-sm text-white/60">
          Esta información está disponible solamente para
          usuarios de la plataforma.
        </p>

        <Link
          href="/login"
          className="mt-6 inline-flex min-h-11 items-center
            justify-center rounded-xl bg-emerald-400
            px-6 py-2 font-semibold text-black
            transition hover:brightness-110"
        >
          Iniciar sesión
        </Link>
      </div>
    </div>
  );
}
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
 <div
  className="mx-auto max-w-6xl space-y-6
    px-3 py-5 sm:space-y-10 sm:p-6"
>
    {cargandoEjecuciones && (
      <div
        className="rounded-2xl border border-emerald-400/15
          bg-emerald-500/[0.06] px-4 py-3
          text-sm text-emerald-100/80"
      >
        Cargando repeticiones de pedidos...
      </div>
    )}

    <CalendarioMensual
      currentMonth={currentMonth}
      pedidos={pedidosConFecha}
      isAdmin={Boolean(isAdmin)}
      onPrevMonth={() =>
        setCurrentMonth((month) =>
          addMonths(month, -1),
        )
      }
      onNextMonth={() =>
        setCurrentMonth((month) =>
          addMonths(month, 1),
        )
      }
    />

    {/* Exclusivo para administradores */}
    {isAdmin && (
      <PedidosPendientesTable
        pedidos={pedidosSinFecha}
        onActualizarCampo={actualizarCampo}
      />
    )}

    {/* Visible para todos los usuarios */}
    <ProyectosFechados
      proyectos={proyectosConFecha}
      pedidos={pedidosFechadosFiltrados}
      totalPedidos={pedidosConFecha.length}
      busqueda={busquedaFechados}
      onBusquedaChange={setBusquedaFechados}
    />
  </div>
);
}