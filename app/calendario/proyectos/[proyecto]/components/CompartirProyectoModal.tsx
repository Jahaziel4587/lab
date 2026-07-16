"use client";

import { useMemo, useState } from "react";
import { FiX } from "react-icons/fi";
import SearchInput from "../../../components/SearchInput";
import type { Usuario } from "../../../types";

type CompartirProyectoModalProps = {
  proyecto: string;
  usuarios: Usuario[];
  seleccionados: Set<string>;
  cargando: boolean;
  guardando: boolean;
  onToggle: (email: string) => void;
  onGuardar: () => Promise<void>;
  onCerrar: () => void;
};

export default function CompartirProyectoModal({
  proyecto,
  usuarios,
  seleccionados,
  cargando,
  guardando,
  onToggle,
  onGuardar,
  onCerrar,
}: CompartirProyectoModalProps) {
  const [busqueda, setBusqueda] = useState("");

  const usuariosFiltrados = useMemo(() => {
    const query = busqueda.trim().toLowerCase();

    if (!query) return usuarios;

    return usuarios.filter(
      (usuario) =>
        usuario.nombre.toLowerCase().includes(query) ||
        usuario.email.toLowerCase().includes(query)
    );
  }, [usuarios, busqueda]);

  const guardar = async () => {
    await onGuardar();
    onCerrar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={() => {
          if (!guardando) onCerrar();
        }}
        aria-label="Cerrar modal"
      />

      <div className="relative rounded-3xl border border-white/10 bg-[#0b0b0f]/95 text-white backdrop-blur-2xl ring-1 ring-white/5 shadow-[0_30px_120px_-50px_rgba(0,0,0,0.95)] w-full max-w-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold">
            Compartir proyecto —{" "}
            <span className="text-white/80">{proyecto}</span>
          </h2>

          <button
            type="button"
            disabled={guardando}
            onClick={onCerrar}
            className="text-white/60 hover:text-white text-xl disabled:opacity-50"
            title="Cerrar"
          >
            <FiX />
          </button>
        </div>

        <p className="text-sm text-white/70 mb-3">
          Selecciona los usuarios que podrán ver este proyecto y
          sus pedidos en Mis solicitudes, aunque ellos no hayan
          creado los pedidos.
        </p>

        <SearchInput
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por nombre o correo..."
        />

        <div className="mt-3 border border-white/10 rounded-2xl max-h-80 overflow-auto bg-white/[0.03]">
          {cargando ? (
            <div className="p-4 text-sm text-white/60">
              Cargando usuarios...
            </div>
          ) : usuariosFiltrados.length === 0 ? (
            <div className="p-4 text-sm text-white/60">
              No hay usuarios que coincidan.
            </div>
          ) : (
            <ul className="divide-y divide-white/10">
              {usuariosFiltrados.map((usuario) => (
                <li
                  key={usuario.email}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-white/[0.03]"
                >
                  <button
                    type="button"
                    onClick={() => onToggle(usuario.email)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="font-medium truncate text-white/90">
                      {usuario.nombre}
                    </div>

                    <div className="text-xs text-white/50 truncate">
                      {usuario.email}
                    </div>
                  </button>

                  <input
                    type="checkbox"
                    checked={seleccionados.has(usuario.email)}
                    onChange={() => onToggle(usuario.email)}
                    className="w-4 h-4 accent-emerald-400"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={guardando}
            onClick={onCerrar}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition disabled:opacity-60"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={guardando}
            onClick={() => void guardar()}
            className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/20 transition disabled:opacity-60 shadow-[0_12px_30px_-22px_rgba(16,185,129,0.9)]"
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>

        <div className="mt-2 text-xs text-white/45">
          {seleccionados.size} usuario
          {seleccionados.size === 1 ? "" : "s"} seleccionado
          {seleccionados.size === 1 ? "" : "s"}
        </div>
      </div>
    </div>
  );
}