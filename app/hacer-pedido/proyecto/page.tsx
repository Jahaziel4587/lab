"use client";

import { useRouter } from "next/navigation";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";

const proyectos = [
  { nombre: "MUV", imagen: "/MUV.jpg" },
  { nombre: "Ocumetics", imagen: "/ocumetics.jpg" },
  { nombre: "Solvein", imagen: "/solvein.jpg" },
  { nombre: "AGMI", imagen: "/AGMI.jpg" },
  { nombre: "XSONXS", imagen: "/XSONX.png" },
  { nombre: "Lumenex", imagen: "/Lumenex.jpeg" },
  { nombre: "Otro", imagen: "/otro.jpg" }, // puedes cambiar la imagen si quieres
];

export default function ProyectoPage() {
  const router = useRouter();

  const seleccionarProyecto = (nombre: string) => {
    // Puedes guardar en localStorage o en un contexto el proyecto seleccionado
    localStorage.setItem("proyecto", nombre);
    router.push("/hacer-pedido/servicios");
  };

  return (
    <div>
      {/* Botón de regreso */}
      <button
        onClick={() => router.push("/")}
        className="mb-4 bg-white text-black px-4 py-2 rounded flex items-center gap-2 hover:bg-gray-200"
      >
        <FiArrowLeft /> Regresar
      </button>

      <h1 className="text-xl mb-6 font-semibold">Selecciona tu proyecto</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {proyectos.map((p) => (
          <button
            key={p.nombre}
            onClick={() => seleccionarProyecto(p.nombre)}
            className="relative rounded-xl overflow-hidden shadow-lg group"
          >
            <img
              src={p.imagen}
              alt={p.nombre}
              className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute bottom-3 left-3 right-3 bg-white text-black rounded-full px-4 py-1 flex justify-between items-center">
              <span className="text-sm font-medium">{p.nombre}</span>
              <FiArrowRight />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
