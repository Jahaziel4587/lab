"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/src/Context/AuthContext";
import { PROJECT_PAGE_SIZE } from "../../constants";
import SearchInput from "../../components/SearchInput";
import { useProyectoCalendario } from "../../hooks/useProyectoCalendario";
import ProyectoHeader from "./components/ProyectoHeader";
import ProyectoPedidosTable from "./components/ProyectoPedidosTable";
import ProyectoPagination from "./components/ProyectoPagination";
import CompartirProyectoModal from "./components/CompartirProyectoModal";

function monthKeyFromValue(value: any): string | null {
  if (!value) return null;

  if (typeof value === "string" && /^\d{4}-\d{2}/.test(value)) {
    return value.slice(0, 7);
  }

  const date = value?.toDate?.() instanceof Date
    ? value.toDate()
    : new Date(value);

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  });

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function ProyectoCalendarioClient({
  proyecto,
}: {
  proyecto: string;
}) {
  const {
  user,
  isAdmin,
  loading: authLoading,
} = useAuth();

  const {
    pedidos,
    usuarios,
    seleccionados,
    cargando,
    cargandoShare,
    guardandoShare,
    error,
    actualizarCampo,
    toggleSeleccion,
    guardarCompartir,
  } = useProyectoCalendario(
  proyecto,
  Boolean(isAdmin),
  Boolean(user),
);

  const [busqueda, setBusqueda] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [page, setPage] = useState(1);
  const [abiertoCompartir, setAbiertoCompartir] =
    useState(false);

  const availableMonths = useMemo(() => {
    return Array.from(
      new Set(
        pedidos
          .map((pedido) => monthKeyFromValue(pedido.fechaEntregaReal))
          .filter((month): month is string => Boolean(month))
      )
    ).sort((a, b) => b.localeCompare(a));
  }, [pedidos]);

  const pedidosFiltrados = useMemo(() => {
    const searchQuery = busqueda.trim().toLowerCase();

    return pedidos.filter((pedido) => {
      if (
        selectedMonth !== "all" &&
        monthKeyFromValue(pedido.fechaEntregaReal) !== selectedMonth
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const titulo = String(pedido.titulo || "").toLowerCase();
      const id = String(pedido.id || "").toLowerCase();

      const solicitante = String(
        pedido.nombreUsuario || pedido.correoUsuario || ""
      ).toLowerCase();

      return (
        titulo.includes(searchQuery) ||
        id.includes(searchQuery) ||
        solicitante.includes(searchQuery)
      );
    });
  }, [pedidos, busqueda, selectedMonth]);

  const totalFiltradoMXN = useMemo(
    () =>
      pedidosFiltrados.reduce(
        (sum, pedido) => sum + Number(pedido.subtotalBaseMXN || 0),
        0
      ),
    [pedidosFiltrados]
  );

  useEffect(() => {
    setPage(1);
  }, [busqueda, selectedMonth, proyecto]);

  const totalPages = Math.max(
    1,
    Math.ceil(pedidosFiltrados.length / PROJECT_PAGE_SIZE)
  );

  const pageSafe = Math.min(
    Math.max(1, page),
    totalPages
  );

  const pedidosPaginados = useMemo(() => {
    const start = (pageSafe - 1) * PROJECT_PAGE_SIZE;

    return pedidosFiltrados.slice(
      start,
      start + PROJECT_PAGE_SIZE
    );
  }, [pedidosFiltrados, pageSafe]);

  if (authLoading) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div
        className="rounded-3xl border border-white/10
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
          bg-black/50 p-8 text-center text-white"
      >
        <h1 className="text-xl font-semibold">
          Debes iniciar sesión
        </h1>

        <p className="mt-2 text-sm text-white/60">
          No tienes acceso a la información de este proyecto
          sin una sesión activa.
        </p>
      </div>
    </div>
  );
}

  if (cargando) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-8 py-10 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center text-white/60">
          Cargando proyecto...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-8 py-10 text-white">
        <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-6 text-red-200">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-8 py-10 text-white">
     <ProyectoHeader
  proyecto={proyecto}
  totalProyectoMXN={totalFiltradoMXN}
  isAdmin={Boolean(isAdmin)}
  onCompartir={() => setAbiertoCompartir(true)}
/>

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.05] backdrop-blur-2xl ring-1 ring-white/5 shadow-[0_20px_90px_-70px_rgba(0,0,0,0.95)] p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex w-full flex-col gap-3 sm:flex-row md:max-w-3xl">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium text-white/60">
              Buscar pedidos
              <SearchInput
                value={busqueda}
                onChange={setBusqueda}
                placeholder="Buscar por título, solicitante o ID..."
                className="w-full"
              />
            </label>

            <label className="flex shrink-0 flex-col gap-1.5 text-xs font-medium text-white/60">
              Filtrar por mes de entrega real
              <select
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white outline-none transition hover:bg-white/[0.08] focus:border-emerald-400/40 sm:w-[220px] [&>option]:bg-zinc-950"
              >
                <option value="all">Todos los meses</option>
                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {formatMonthLabel(month)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="text-sm text-white/60">
            Mostrando{" "}
            <span className="font-semibold text-white/80">
              {pedidosFiltrados.length}
            </span>{" "}
            pedidos
          </div>
        </div>
      </div>

      <div className="mt-6">
        {pedidos.length === 0 ? (
          <p className="text-white/70">
            No hay pedidos con fecha real en este proyecto.
          </p>
        ) : pedidosFiltrados.length === 0 ? (
          <p className="text-white/70">
            No hay pedidos para la búsqueda y el mes seleccionados.
          </p>
        ) : (
          <>
            <ProyectoPedidosTable
            pedidos={pedidosPaginados}
            page={pageSafe}
            totalPages={totalPages}
            totalProyectoMXN={totalFiltradoMXN}
            isAdmin={Boolean(isAdmin)}
            onActualizarCampo={actualizarCampo}
            />

            <ProyectoPagination
              page={pageSafe}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

     {isAdmin && abiertoCompartir && (
        <CompartirProyectoModal
          proyecto={proyecto}
          usuarios={usuarios}
          seleccionados={seleccionados}
          cargando={cargandoShare}
          guardando={guardandoShare}
          onToggle={toggleSeleccion}
          onGuardar={guardarCompartir}
          onCerrar={() => setAbiertoCompartir(false)}
        />
      )}
    </div>
  );
}
