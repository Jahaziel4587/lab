"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiArrowRight } from "react-icons/fi";
import OrderFlowHeader from "../components/OrderFlowHeader";

type ServicioItem = {
  key: string;
  label: string;
  code: string;
  route?: string;
};

const servicios: ServicioItem[] = [
  { key: "Corte", label: "Corte", code: "01" },
  { key: "Grabado", label: "Grabado", code: "02" },
  { key: "Impresión", label: "Impresión", code: "03" },
  { key: "Fixture", label: "Fixturing & Jigs", code: "04" },
  {
    key: "Necesidad",
    label: "Necesidad",
    code: "05",
    route: "/hacer-pedido/especificaciones",
  },
];

export default function ServiciosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vieneDeFixture = !!searchParams.get("fixtureRelacionadoId");

  useEffect(() => {
    const fixtureRelacionadoId = searchParams.get("fixtureRelacionadoId");
    const fixtureRelacionadoFase = searchParams.get("fixtureRelacionadoFase");
    const fixtureRelacionadoVersion = searchParams.get("fixtureRelacionadoVersion");
    const proyecto = searchParams.get("proyecto");

    if (fixtureRelacionadoId) {
      localStorage.setItem("fixtureRelacionadoId", fixtureRelacionadoId);
      localStorage.setItem("fixtureRelacionadoFase", fixtureRelacionadoFase || "");
      localStorage.setItem("fixtureRelacionadoVersion", fixtureRelacionadoVersion || "");
      localStorage.setItem("fixtureRelacionadoProyecto", proyecto || "");
      if (proyecto) localStorage.setItem("proyecto", proyecto);
    }
  }, [searchParams]);

  const seleccionarServicio = (item: ServicioItem) => {
    localStorage.setItem("servicio", item.key);

    if (item.key === "Necesidad") {
      localStorage.removeItem("maquina");
      localStorage.removeItem("material");
      localStorage.removeItem("tecnica");
      router.push(item.route || "/hacer-pedido/especificaciones");
      return;
    }

    if (item.key === "Fixture") {
      localStorage.removeItem("maquina");
      localStorage.removeItem("material");
      localStorage.removeItem("tecnica");
      router.push("/hacer-pedido/fixturing");
      return;
    }

    router.push("/hacer-pedido/maquinas");
  };

  const serviciosDisponibles = vieneDeFixture
    ? servicios.filter((s) => s.key !== "Fixture")
    : servicios;

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6 sm:py-8">
      <OrderFlowHeader
        step={2}
        title="Selecciona el servicio"
        description="Elige el tipo de trabajo que necesitas para continuar."
        onBack={() => (vieneDeFixture ? router.back() : router.push("/hacer-pedido/proyecto"))}
      />

      {vieneDeFixture && (
        <div className="mb-4 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3.5 py-3 text-sm leading-relaxed text-emerald-100 sm:mb-5 sm:rounded-2xl sm:px-4">
          Pedido asociado a fixture: selecciona el servicio requerido para esta fase.
        </div>
      )}

      {/* Móvil */}
      <div className="space-y-2.5 sm:hidden">
        {serviciosDisponibles.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => seleccionarServicio(s)}
            className="flex min-h-[72px] w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3.5 py-3 text-left active:bg-white/[0.08]"
          >
            <span className="w-11 shrink-0 text-2xl font-bold tracking-tight text-emerald-300">
              {s.code}
            </span>
            <span className="min-w-0 flex-1 text-base font-semibold text-white/90">
              {s.label}
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/55">
              <FiArrowRight />
            </span>
          </button>
        ))}
      </div>

      {/* Tablet / escritorio */}
      <div className="hidden grid-cols-2 gap-6 sm:grid">
        {serviciosDisponibles.map((s) => (
          <button
            key={s.key}
            onClick={() => seleccionarServicio(s)}
            className="group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left shadow-[0_10px_35px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-white/10"
          >
            <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-400/40" />
            <div className="flex items-center justify-between gap-6 p-6 md:p-7">
              <div className="min-w-0">
                <div className="text-5xl font-bold tracking-tight text-emerald-300 md:text-6xl">
                  {s.code}
                </div>
                <div className="mt-1 truncate text-lg font-semibold text-white md:text-xl">
                  {s.label}
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
    </div>
  );
}
