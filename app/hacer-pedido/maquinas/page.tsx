"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";

const MAQUINAS = [
  { nombre: "Laser CO2", imagen: "/laser.jpg", servicio: "corte" },
  { nombre: "Fresadora CNC", imagen: "/corte.jpg", servicio: "corte" },
  { nombre: "Filamento", imagen: "/filamentos.jpg", servicio: "impresion" },
  { nombre: "Resina", imagen: "/resinas.png", servicio: "impresion" },
 { nombre: "Libre", imagen: "/libre.png", servicio: "fixture" },
  //{ nombre: "BambuLab", imagen: "/bambulab.png", servicio: "impresion" },
 // { nombre: "Mayku", imagen: "/mayku.jpg", servicio: "fixture" },
];

export default function MaquinasPage() {
  const router = useRouter();
  const [servicio, setServicio] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("servicio");
    if (stored) {
      setServicio(stored.toLowerCase());
    } else {
      router.push("/hacer-pedido/servicios");
    }
  }, [router]);

  const seleccionarMaquina = (nombre: string) => {
    localStorage.setItem("maquina", nombre);
    router.push("/hacer-pedido/material");
  };

  if (!servicio) return null;

  const maquinasFiltradas =
    servicio === "fixture"
      ? MAQUINAS
      : MAQUINAS.filter((m) => m.servicio === servicio);

  return (
    <div>
      {/* Botón de regresar */}
      <button
        onClick={() => router.push("/hacer-pedido/servicios")}
        className="mb-4 bg-white text-black px-4 py-2 rounded flex items-center gap-2 hover:bg-gray-200"
      >
        <FiArrowLeft /> Regresar
      </button>

      <h1 className="text-xl mb-6 font-semibold">Selecciona la técnica</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {maquinasFiltradas.map((m) => (
          <button
            key={m.nombre}
            onClick={() => seleccionarMaquina(m.nombre)}
            className="relative rounded-xl overflow-hidden shadow-lg group"
          >
            <img
              src={m.imagen}
              alt={m.nombre}
              className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute bottom-3 left-3 right-3 bg-white text-black rounded-full px-4 py-1 flex justify-between items-center">
              <span className="text-sm font-medium">{m.nombre}</span>
              <FiArrowRight />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
