"use client";

import { useRouter } from "next/navigation";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";

type ServicioItem = {
  key: string; // lo que guardas en localStorage
  label: string; // lo que se muestra
  code: string; // lo grande (para ubicar rápido)
  route?: string; // opcional si quieres override
};

const servicios: ServicioItem[] = [
  { key: "Corte", label: "Corte", code: "01" },
  { key: "Grabado", label: "Grabado", code: "02" },
  { key: "Impresión", label: "Impresión", code: "03" },
  { key: "Fixture", label: "Diseño de fixture", code: "04" },
  { key: "Necesidad", label: "Necesidad", code: "05", route: "/hacer-pedido/especificaciones" },
];

export default function ServiciosPage() {
  const router = useRouter();

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
    // Guardar servicio
    localStorage.setItem("servicio", item.key);

    // Si es “Necesidad”, limpia residuos porque se brinca pasos
    if (item.key === "Necesidad") {
      localStorage.removeItem("maquina");
      localStorage.removeItem("material");
      localStorage.removeItem("tecnica");
      router.push(item.route || "/hacer-pedido/especificaciones");
      return;
    }

    router.push("/hacer-pedido/maquinas");
  };

  return (
    <div className="relative">
      {/* Top controls */}
      <button
        onClick={() => router.push("/hacer-pedido/proyecto")}
        className={`${baseButton} mb-4`}
      >
        <FiArrowLeft className="opacity-80" /> Regresar
      </button>

      <h1 className="text-2xl md:text-3xl font-semibold text-white mb-1">
        Selecciona el servicio
      </h1>
      <p className="text-sm text-white/60 mb-6">
        Elige el tipo de trabajo para continuar.
      </p>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {servicios.map((s) => (
          <button
            key={s.key}
            onClick={() => seleccionarServicio(s)}
            className={cardBase}
          >
            {/* Accent line bottom (teal) */}
            <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-400/40" />

            <div className="p-6 md:p-7 flex items-center justify-between gap-6">
              <div className="min-w-0">
                <div className="text-5xl md:text-6xl font-bold text-emerald-300 tracking-tight">
                  {s.code}
                </div>

                <div className="mt-1 text-lg md:text-xl font-semibold text-white truncate">
                  {s.label}
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
    </div>
  );
}
