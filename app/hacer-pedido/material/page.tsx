"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";

// Diccionario de materiales por máquina
const MATERIALES_POR_MAQUINA: Record<string, string[]> = {
  Filamento: [
    "PLA 2.85mm (Ultimaker 2+)",
    "PLA 1.75mm (Bambu Lab)",
    "Nylon 1.75 (Bambu Lab)",
    "PLA retardante de fuego 1.75mm (Bambu Lab)",
    "Nylon retardante de fuego 1.75 (Bambu Lab)",
    "Otro",
  ],
  "Resina Formlabs 3B": [
    "Rigid 10K",
    "Black",
    "BioMed Amber",
    "BioMed Black",
    "High Temp",
    "White",
    "Clear",
    "Flexible 80A",
    "Otro",
  ],
  "Resina Formlabs 2B": [
    "Rigid 10K",
    "Black",
    "BioMed Amber",
    "BioMed Black",
    "High Temp",
    "White",
    "Clear",
    "Flexible 80A",
    "Otro",
  ],
  "Láser CO2": [
    "Acrílico 2mm",
    "Acrílico blanco 3mm",
    "Acrílico negro 3mm",
    "Acrílico Transparente 4mm",
    "MDF 4mm",
    "Cartón",
    "Tela",
    "Papel",
    "Otro",
  ],
  "Fresadora CNC": [
    "Triplay 12.7mm",
    "HDPE 6mm",
    "HDPE 12.7mm",
    "MDF 18 mm",
    "Polipropileno",
    "Otro",
  ],
  Libre: ["Libre"],
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export default function MaterialPage() {
  const router = useRouter();
  const [maquina, setMaquina] = useState<string | null>(null);

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
    const stored = localStorage.getItem("maquina");
    if (stored) {
      setMaquina(stored);
    } else {
      router.push("/hacer-pedido/maquinas");
    }
  }, [router]);

  const materiales = useMemo(() => {
    if (!maquina) return [];
    return MATERIALES_POR_MAQUINA[maquina] || ["Otro"];
  }, [maquina]);

  const seleccionarMaterial = (material: string) => {
    localStorage.setItem("material", material);
    router.push("/hacer-pedido/especificaciones");
  };

  if (!maquina) return null;

  return (
    <div className="relative">
      <button onClick={() => router.push("/hacer-pedido/maquinas")} className={`${baseButton} mb-4`}>
        <FiArrowLeft className="opacity-80" /> Regresar
      </button>

      <h1 className="text-2xl md:text-3xl font-semibold text-white mb-1">
        Selecciona el material
      </h1>
      <p className="text-sm text-white/60 mb-6">
        Máquina seleccionada: <span className="text-white/80 font-medium">{maquina}</span>
      </p>

      {materiales.length === 0 ? (
        <div className="text-white/70 bg-white/5 border border-white/10 rounded-2xl p-5">
          No hay materiales configurados para esta máquina.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {materiales.map((mat, idx) => (
            <button
              key={`${mat}-${idx}`}
              onClick={() => seleccionarMaterial(mat)}
              className={cardBase}
            >
              <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-400/40" />

              <div className="p-6 flex items-center justify-between gap-6">
                <div className="min-w-0">
                  <div className="text-5xl font-bold text-emerald-300 tracking-tight">
                    {pad2(idx + 1)}
                  </div>

                  <div className="mt-1 text-lg font-semibold text-white">
                    {mat}
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
