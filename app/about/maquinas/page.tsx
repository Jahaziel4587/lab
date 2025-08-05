"use client";
import Link from "next/link";

const maquinas = [
  { nombre: "Lasermex", ruta: "lasermex" },
  { nombre: "Ultimaker 2+", ruta: "ultimaker" },
  { nombre: "Formlabs 2B", ruta: "formlabs2a" },
  //{ nombre: "Formlabs 3B", ruta: "formlabsa" },
  { nombre: "BambuLab", ruta: "bambulab" },
  { nombre: "Avid CNC bentchPro 24x24", ruta: "avidcnc" },
  { nombre: "Mayku Formbox", ruta: "mayku" },
];

export default function MaquinasPage() {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 px-6 py-20">
      <h1 className="text-3xl font-bold text-center mb-10">Máquinas Disponibles</h1>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
        {maquinas.map((maquina) => (
          <Link key={maquina.ruta} href={`/about/maquinas/${maquina.ruta}`}>
            <div className="bg-white p-6 rounded-lg shadow-md hover:bg-blue-50 hover:scale-105 transition cursor-pointer">
              <h2 className="text-lg font-semibold text-center">{maquina.nombre}</h2>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
