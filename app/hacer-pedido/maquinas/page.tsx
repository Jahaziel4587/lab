"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";

type Maquina = {
  key: string;      // lo que guardas en localStorage
  label: string;    // lo que se muestra
  code: string;     // número grande
  servicio: string; // para filtrar
};

const MAQUINAS: Maquina[] = [
  // Corte
  { key: "Láser CO2", label: "Láser CO2", code: "01", servicio: "corte" },
  { key: "Fresadora CNC", label: "Fresadora CNC", code: "02", servicio: "corte" },

  // Impresión
  { key: "Filamento", label: "Filamento", code: "03", servicio: "impresión" },
  { key: "Resina Formlabs 3B", label: "Resina Formlabs 3B", code: "04", servicio: "impresión" },
  { key: "Resina Formlabs 2B", label: "Resina Formlabs 2B", code: "05", servicio: "impresión" },

  // Grabado
  { key: "Láser CO2", label: "Láser CO2", code: "01", servicio: "grabado" },
  { key: "Fresadora CNC", label: "Fresadora CNC", code: "02", servicio: "grabado" },

  // Fixture (o “Diseño de fixture”)
  { key: "Libre", label: "Libre", code: "00", servicio: "fixture" },
  { key: "Fresadora CNC", label: "Fresadora CNC", code: "02", servicio: "fixture" },
  { key: "Filamento", label: "Filamento", code: "03", servicio: "fixture" },
  { key: "Resina Formlabs 3B", label: "Resina Formlabs 3B", code: "04", servicio: "fixture" },
  { key: "Resina Formlabs 2B", label: "Resina Formlabs 2B", code: "05", servicio: "fixture" },
  { key: "Láser CO2", label: "Láser CO2", code: "01", servicio: "fixture" },
];

function normalizeServicio(raw: string) {
  const s = (raw || "").trim().toLowerCase();

  // unificar valores posibles que guardas en localStorage
  if (s.includes("fixture")) return "fixture"; // "fixture", "diseño de fixture", etc.
  if (s.includes("impres")) return "impresión"; // "impresión", "impresion"
  if (s.includes("grab")) return "grabado";
  if (s.includes("corte")) return "corte";

  return s;
}

export default function MaquinasPage() {
  const router = useRouter();
  const [servicio, setServicio] = useState<string | null>(null);

  const baseButton =
    "flex items-center gap-2 px-4 py-2 rounded-full " +
    "bg-white/10 text-white backdrop-blur " +
    "border border-white/10 " +
    "hover:bg-white/20 transition";

  const cardBase =
    "group relative w-full rounded-2xl overflow-hidden " +
    "bg-white/5 backdrop-blur border border-white/10 " +
    "shadow-[0_10px_35px_rgba(0,0,0,0.35)] " +
    "hover:bg-white/10 transition text-left";

  useEffect(() => {
    const stored = localStorage.getItem("servicio");
    if (!stored) {
      router.push("/hacer-pedido/servicios");
      return;
    }
    setServicio(normalizeServicio(stored));
  }, [router]);

  const maquinasFiltradas = useMemo(() => {
    if (!servicio) return [];
    return MAQUINAS.filter((m) => normalizeServicio(m.servicio) === servicio);
  }, [servicio]);

  const seleccionarMaquina = (nombre: string) => {
    localStorage.setItem("maquina", nombre);
    router.push("/hacer-pedido/material");
  };

  if (!servicio) return null;

  return (
    <div className="relative">
      <button onClick={() => router.push("/hacer-pedido/servicios")} className={`${baseButton} mb-4`}>
        <FiArrowLeft className="opacity-80" /> Regresar
      </button>

      <h1 className="text-2xl md:text-3xl font-semibold text-white mb-1">
        Selecciona la técnica
      </h1>
      <p className="text-sm text-white/60 mb-6">
        Servicio seleccionado: <span className="text-white/80 font-medium capitalize">{servicio}</span>
      </p>

      {maquinasFiltradas.length === 0 ? (
        <div className="text-white/70 bg-white/5 border border-white/10 rounded-2xl p-5">
          No hay máquinas configuradas para este servicio.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {maquinasFiltradas.map((m, idx) => (
            <button
              key={`${m.key}-${m.servicio}-${idx}`}
              onClick={() => seleccionarMaquina(m.key)}
              className={cardBase}
            >
              <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-400/40" />

              <div className="p-6 flex items-center justify-between gap-6">
                <div className="min-w-0">
                  <div className="text-5xl font-bold text-emerald-300 tracking-tight">
                    {m.code}
                  </div>

                  <div className="mt-1 text-lg font-semibold text-white truncate">
                    {m.label}
                  </div>

                  <div className="mt-2 text-sm text-white/50">
                    Click para continuar
                  </div>
                </div>

                <div className="shrink-0">
                  <div className="h-11 w-11 rounded-full bg-white/10 border border-white/10 flex items-center justify-center group-hover:bg-white/20 transition">
                    <FiArrowRight className="text-white/80" />
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
