"use client";

import { useRouter } from "next/navigation";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";

const servicios = [
  { nombre: "Corte", imagen: "/corte.jpg" },
  { nombre: "Impresion", imagen: "/impresion3D.jpg" },
  { nombre: "Fixture", imagen: "/fixture.jpg" },
  { nombre: "Fixture no diseñado", imagen: "/fixture-no-diseñado.jpg" },
  { nombre: "Necesidad", imagen: "/fixture-no-diseñado.jpg" }, // nueva tarjeta
];

export default function ServiciosPage() {
  const router = useRouter();

  const seleccionarServicio = (nombre: string) => {
    if (nombre === "Necesidad") {
      router.push("/hacer-pedido/especificaciones");
      return;
    }

    const key = nombre === "Fixture no diseñado" ? "Fixture" : nombre;
    localStorage.setItem("servicio", key);
    router.push("/hacer-pedido/maquinas");
  };

  return (
    <div>
      {/* Botón de regreso */}
      <button
        onClick={() => router.push("/hacer-pedido/proyecto")}
        className="mb-4 bg-white text-black px-4 py-2 rounded flex items-center gap-2 hover:bg-gray-200"
      >
        <FiArrowLeft /> Regresar
      </button>

      <h1 className="text-xl mb-6 font-semibold">Selecciona el servicio</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-6">
        {servicios.map((s) => (
          <button
            key={s.nombre}
            onClick={() => seleccionarServicio(s.nombre)}
            className="relative rounded-xl overflow-hidden shadow-lg group"
          >
            <img
              src={s.imagen}
              alt={s.nombre}
              className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute bottom-3 left-3 right-3 bg-white text-black rounded-full px-4 py-1 flex justify-between items-center">
              <span className="text-sm font-medium capitalize">{s.nombre}</span>
              <FiArrowRight />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
