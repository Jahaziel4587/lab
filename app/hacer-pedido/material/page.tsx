"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";

// Diccionario de materiales por máquina
const MATERIALES_POR_MAQUINA: Record<string, string[]> = {
  "Filamento": ["PLA 2.85mm (Ultimaker 2+)", "PLA 1.75mm (BambuLab)", "Otro"],
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
    "Acrílico 3mm",
    "Acrílico 4mm",
    "Cartón",
    "Tela",
    "Papel",
    "Otro",
  ],
  "Fresadora CNC": ["Madera", "MDF","Otro",],
  "Libre": ["Libre"],
};

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

  const seleccionarMaterial = (material: string) => {
    localStorage.setItem("material", material);
    router.push("/hacer-pedido/especificaciones");
  };

  if (!maquina) return null;

  const materiales = MATERIALES_POR_MAQUINA[maquina] || ["Otro"];

  return (
    <div>
      {/* Botón de regreso */}
      <button
        onClick={() => router.push("/hacer-pedido/maquinas")}
        className="mb-4 bg-white text-black px-4 py-2 rounded flex items-center gap-2 hover:bg-gray-200"
      >
        <FiArrowLeft /> Regresar
      </button>

      <h1 className="text-xl mb-6 font-semibold">Selecciona el material</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {materiales.map((mat) => (
          <button
            key={mat}
            onClick={() => seleccionarMaterial(mat)}
            className="relative rounded-xl overflow-hidden shadow-lg bg-white text-black group hover:scale-105 transition-transform duration-300"
          >
            <div className="p-6 text-center font-semibold flex items-center justify-center h-32">
              <span>{mat}</span>
              <FiArrowRight className="ml-2" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

