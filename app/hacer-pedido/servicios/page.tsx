"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";

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
    const fixtureRelacionadoVersion = searchParams.get(
      "fixtureRelacionadoVersion"
    );
    const proyecto = searchParams.get("proyecto");

    if (fixtureRelacionadoId) {
      localStorage.setItem("fixtureRelacionadoId", fixtureRelacionadoId);
      localStorage.setItem(
        "fixtureRelacionadoFase",
        fixtureRelacionadoFase || ""
      );
      localStorage.setItem(
        "fixtureRelacionadoVersion",
        fixtureRelacionadoVersion || ""
      );
      localStorage.setItem("fixtureRelacionadoProyecto", proyecto || "");

      if (proyecto) {
        localStorage.setItem("proyecto", proyecto);
      }
    }
  }, [searchParams]);

  const baseButton =
    "flex items-center gap-2 px-4 py-2 rounded-full " +
    "bg-white/10 text-white backdrop-blur " +
    "border border-white/10 " +
    "hover:bg-white/20 transition";

  const cardBase =
    "group relative w-full rounded-2xl overflow-hidden " +
    "bg-white/5 backdrop-blur border border-white/10 " +
    "shadow-[0_10px_35px_rgba(0,0,0,0.35)] " +
    "hover:bg-white/10 transition " +
    "text-left";

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

  return (
    <div className="relative">
      <button
        onClick={() =>
          vieneDeFixture
            ? router.back()
            : router.push("/hacer-pedido/proyecto")
        }
        className={`${baseButton} mb-4`}
      >
        <FiArrowLeft className="opacity-80" /> Regresar
      </button>

      {vieneDeFixture && (
        <div className="mb-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          Pedido asociado a fixture: selecciona el servicio que se requiere para
          esta fase.
        </div>
      )}

      <h1 className="mb-1 text-2xl font-semibold text-white md:text-3xl">
        Selecciona el servicio
      </h1>

      <p className="mb-6 text-sm text-white/60">
        Elige el tipo de trabajo para continuar.
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {servicios.map((s) => (
          <button
            key={s.key}
            onClick={() => seleccionarServicio(s)}
            className={cardBase}
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

                <div className="mt-2 text-sm text-white/50">
                  Click para continuar
                </div>
              </div>

              <div className="shrink-0">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 transition group-hover:bg-white/20">
                  <FiArrowRight className="text-white/80" />
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}