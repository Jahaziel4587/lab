"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowRight } from "react-icons/fi";
import OrderFlowHeader from "../components/OrderFlowHeader";

type Maquina = {
  key: string;
  label: string;
  code: string;
  servicio: string;
};

const MAQUINAS: Maquina[] = [
  { key: "Láser CO2", label: "Láser CO2", code: "01", servicio: "corte" },
  { key: "Fresadora CNC", label: "Fresadora CNC", code: "02", servicio: "corte" },
  { key: "Filamento", label: "Filamento", code: "03", servicio: "impresión" },
  { key: "Resina Formlabs 3B", label: "Resina Formlabs 3B", code: "04", servicio: "impresión" },
  { key: "Resina Formlabs 2B", label: "Resina Formlabs 2B", code: "05", servicio: "impresión" },
  { key: "Láser CO2", label: "Láser CO2", code: "01", servicio: "grabado" },
  { key: "Fresadora CNC", label: "Fresadora CNC", code: "02", servicio: "grabado" },
  { key: "Libre", label: "Libre", code: "00", servicio: "fixture" },
  { key: "Fresadora CNC", label: "Fresadora CNC", code: "02", servicio: "fixture" },
  { key: "Filamento", label: "Filamento", code: "03", servicio: "fixture" },
  { key: "Resina Formlabs 3B", label: "Resina Formlabs 3B", code: "04", servicio: "fixture" },
  { key: "Resina Formlabs 2B", label: "Resina Formlabs 2B", code: "05", servicio: "fixture" },
  { key: "Láser CO2", label: "Láser CO2", code: "01", servicio: "fixture" },
];

function normalizeServicio(raw: string) {
  const s = (raw || "").trim().toLowerCase();
  if (s.includes("fixture")) return "fixture";
  if (s.includes("impres")) return "impresión";
  if (s.includes("grab")) return "grabado";
  if (s.includes("corte")) return "corte";
  return s;
}

export default function MaquinasPage() {
  const router = useRouter();
  const [servicio, setServicio] = useState<string | null>(null);

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
    <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6 sm:py-8">
      <OrderFlowHeader
        step={3}
        title="Selecciona la técnica"
        description="Elige la máquina o técnica con la que se realizará el trabajo."
        detail={`Servicio seleccionado: ${servicio}`}
        onBack={() => router.push("/hacer-pedido/servicios")}
      />

      {maquinasFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-white/65">
          No hay máquinas configuradas para este servicio.
        </div>
      ) : (
        <>
          <div className="space-y-2.5 sm:hidden">
            {maquinasFiltradas.map((m, idx) => (
              <button
                key={`${m.key}-${m.servicio}-${idx}`}
                type="button"
                onClick={() => seleccionarMaquina(m.key)}
                className="flex min-h-[72px] w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3.5 py-3 text-left active:bg-white/[0.08]"
              >
                <span className="w-11 shrink-0 text-2xl font-bold tracking-tight text-emerald-300">
                  {m.code}
                </span>
                <span className="min-w-0 flex-1 break-words text-base font-semibold leading-snug text-white/90">
                  {m.label}
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/55">
                  <FiArrowRight />
                </span>
              </button>
            ))}
          </div>

          <div className="hidden grid-cols-2 gap-6 sm:grid md:grid-cols-3">
            {maquinasFiltradas.map((m, idx) => (
              <button
                key={`${m.key}-${m.servicio}-${idx}`}
                onClick={() => seleccionarMaquina(m.key)}
                className="group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left shadow-[0_10px_35px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-white/10"
              >
                <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-400/40" />
                <div className="flex items-center justify-between gap-6 p-6">
                  <div className="min-w-0">
                    <div className="text-5xl font-bold tracking-tight text-emerald-300">
                      {m.code}
                    </div>
                    <div className="mt-1 truncate text-lg font-semibold text-white">
                      {m.label}
                    </div>
                    <div className="mt-2 text-sm text-white/50">Click para continuar</div>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 transition group-hover:bg-white/20">
                    <FiArrowRight className="text-white/80" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
