"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/src/Context/AuthContext";
import { PROJECT_PAGE_SIZE } from "../../constants";
import SearchInput from "../../components/SearchInput";
import { useProyectoCalendario } from "../../hooks/useProyectoCalendario";
import ProyectoHeader from "./components/ProyectoHeader";
import ProyectoPedidosTable from "./components/ProyectoPedidosTable";
import ProyectoPagination from "./components/ProyectoPagination";
import CompartirProyectoModal from "./components/CompartirProyectoModal";

export default function ProyectoCalendarioClient({
  proyecto,
}: {
  proyecto: string;
}) {
  const { isAdmin } = useAuth();

  const {
    pedidos,
    usuarios,
    seleccionados,
    cargando,
    cargandoShare,
    guardandoShare,
    error,
    totalProyectoMXN,
    actualizarCampo,
    toggleSeleccion,
    guardarCompartir,
  } = useProyectoCalendario(proyecto, Boolean(isAdmin));

  const [busqueda, setBusqueda] = useState("");
  const [page, setPage] = useState(1);
  const [abiertoCompartir, setAbiertoCompartir] =
    useState(false);

  const pedidosFiltrados = useMemo(() => {
    const query = busqueda.trim().toLowerCase();

    if (!query) return pedidos;

    return pedidos.filter((pedido) => {
      const titulo = String(pedido.titulo || "").toLowerCase();
      const id = String(pedido.id || "").toLowerCase();

      const solicitante = String(
        pedido.nombreUsuario || pedido.correoUsuario || ""
      ).toLowerCase();

      return (
        titulo.includes(query) ||
        id.includes(query) ||
        solicitante.includes(query)
      );
    });
  }, [pedidos, busqueda]);

  useEffect(() => {
    setPage(1);
  }, [busqueda, proyecto]);

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

  if (!isAdmin) {
    return (
      <div className="max-w-5xl mx-auto bg-white text-black p-6 rounded-xl shadow">
        <p>No autorizado.</p>

        <Link
          href="/calendario"
          className="text-blue-600 underline"
        >
          Volver al calendario
        </Link>
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
        totalProyectoMXN={totalProyectoMXN}
        onCompartir={() => setAbiertoCompartir(true)}
      />

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.05] backdrop-blur-2xl ring-1 ring-white/5 shadow-[0_20px_90px_-70px_rgba(0,0,0,0.95)] p-4 sm:p-5">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <SearchInput
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar por título, solicitante o ID..."
            className="w-full md:max-w-lg"
          />

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
            No hay resultados para esa búsqueda.
          </p>
        ) : (
          <>
            <ProyectoPedidosTable
              pedidos={pedidosPaginados}
              page={pageSafe}
              totalPages={totalPages}
              totalProyectoMXN={totalProyectoMXN}
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

      {abiertoCompartir && (
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