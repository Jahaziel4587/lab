"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowRight } from "react-icons/fi";
import OrderFlowHeader from "../components/OrderFlowHeader";

const MATERIALES_POR_MAQUINA: Record<string, string[]> = {
  Filamento: [
    "PLA 1.75mm (Bambu Lab)",
    "Nylon 1.75 (Bambu Lab)",
    "PLA retardante de fuego 1.75mm (Bambu Lab)",
    "Nylon retardante de fuego 1.75 (Bambu Lab)",
    "Otro (Especifica en la descripción)",
    "ABS",
    "TPU",
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
    "Otro (Especifica en la descripción)",
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
    "Otro (Especifica en la descripción)",
  ],
  "Láser CO2": [
    "Acrílico 2mm",
    "Acrílico blanco 3mm",
    "Acrílico negro 3mm",
    "Acrílico Transparente 4mm",
    "Acrilico 6mm",
    "MDF 4mm",
    "MDF 3mm",
    "Cartón",
    "Tela",
    "Papel",
    "Otro (Especifica en la descripción)",
  ],
  "Fresadora CNC": [
    "Triplay 12.7mm",
    "HDPE 6mm",
    "HDPE 12.7mm",
    "MDF 18 mm",
    "Polipropileno",
    "PEEK",
    "Otro (Especifica en la descripción)",
  ],
  Libre: ["Libre"],
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export default function MaterialPage() {
  const router = useRouter();
  const [maquina, setMaquina] = useState<string | null>(null);

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
    <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-8">
      <OrderFlowHeader
        step={4}
        title="Selecciona el material"
        description="Selecciona el material principal que se utilizará en el pedido."
        detail={`Técnica seleccionada: ${maquina}`}
        onBack={() => router.push("/hacer-pedido/maquinas")}
      />

      {materiales.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-white/65">
          No hay materiales configurados para esta máquina.
        </div>
      ) : (
        <>
          <div className="space-y-2.5 sm:hidden">
            {materiales.map((mat, idx) => (
              <button
                key={`${mat}-${idx}`}
                type="button"
                onClick={() => seleccionarMaterial(mat)}
                className="flex min-h-[68px] w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3.5 py-3 text-left active:bg-white/[0.08]"
              >
                <span className="w-11 shrink-0 text-xl font-bold tracking-tight text-emerald-300">
                  {pad2(idx + 1)}
                </span>
                <span className="min-w-0 flex-1 break-words text-sm font-semibold leading-snug text-white/90">
                  {mat}
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/55">
                  <FiArrowRight />
                </span>
              </button>
            ))}
          </div>

          <div className="hidden grid-cols-2 gap-6 sm:grid md:grid-cols-3">
            {materiales.map((mat, idx) => (
              <button
                key={`${mat}-${idx}`}
                onClick={() => seleccionarMaterial(mat)}
                className="group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left shadow-[0_10px_35px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-white/10"
              >
                <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-400/40" />
                <div className="flex items-center justify-between gap-6 p-6">
                  <div className="min-w-0">
                    <div className="text-5xl font-bold tracking-tight text-emerald-300">
                      {pad2(idx + 1)}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">{mat}</div>
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
