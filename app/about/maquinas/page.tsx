"use client";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";

const maquinas = [
  { nombre: "Lasermex", ruta: "lasermex", imagen: "/lasermex.png" },
  { nombre: "Ultimaker 2+", ruta: "ultimaker", imagen: "/Ultimaker.jpg" },
  { nombre: "Formlabs 2B", ruta: "formlabs2", imagen: "/formlabs2B.jpeg" },
  { nombre: "Formlabs 3B", ruta: "formlabs3A", imagen: "/formlabs3B.jpg" },
  { nombre: "BambuLab", ruta: "bambulab", imagen: "/bambulab.png" },
  { nombre: "Avid CNC Benchtop 24x24", ruta: "avidcnc", imagen: "/cnc.jpg" },
  { nombre: "Mayku Formbox", ruta: "mayku", imagen: "/mayku.jpg" },
];

export default function MaquinasPage() {
  return (
    
    <div className="min-h-screen  text-gray-900 px-6 py-20">
       {/* Botón de regreso */}
      <div className="max-w-6xl mx-auto mb-6">
        <button
          onClick={() => window.history.back()}
          className="mb-4 bg-white text-black px-4 py-2 rounded flex items-center gap-2 hover:bg-black-200"
        >
          <FiArrowLeft /> Regresar
        </button>
      </div>
      <h1 className="text-white text-3xl font-bold text-center mb-10">Máquinas Disponibles</h1>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
        {maquinas.map((maquina) => (
          <Link key={maquina.ruta} href={`/about/maquinas/${maquina.ruta}`}>
            <div className="bg-white rounded-xl overflow-hidden shadow-md group hover:shadow-lg transition-transform hover:scale-105 cursor-pointer">
              <img
                src={maquina.imagen}
                alt={maquina.nombre}
                className="w-full h-48 object-cover"
              />
              <div className="p-4 text-center">
                <h2 className="text-lg font-semibold">{maquina.nombre}</h2>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
