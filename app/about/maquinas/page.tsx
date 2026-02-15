"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

const maquinas = [
  { nombre: "Lasermex", ruta: "lasermex", imagen: "/lasermex.png" },
  { nombre: "Ultimaker 2+", ruta: "ultimaker", imagen: "/Ultimaker.jpg" },
  { nombre: "Formlabs 2B", ruta: "formlabs2", imagen: "/formlabs2B.jpeg" },
  { nombre: "Formlabs 3B", ruta: "formlabs3A", imagen: "/formlabs3B.jpg" },
  { nombre: "BambuLab", ruta: "bambulab", imagen: "/bambulab.png" },
  { nombre: "Avid CNC Benchtop 24x24", ruta: "avidcnc", imagen: "/cnc.jpg" },
  { nombre: "Mayku Formbox", ruta: "mayku", imagen: "/mayku.jpg" },
  { nombre: "Form Cure", ruta: "formcure", imagen: "/formcure.jpg" },
  { nombre: "Form Wash", ruta: "formwash", imagen: "/formwash.jpg" },
];

export default function MaquinasPage() {
  return (
    <div className="min-h-screen px-6 py-24 text-white">
      
      {/* Botón regresar */}
      <div className="max-w-6xl mx-auto mb-10">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-sm text-gray-300 hover:text-emerald-400 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Regresar
        </button>
      </div>

      {/* Título */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold tracking-tight">
          Equipos Disponibles
        </h1>
        <p className="mt-4 text-gray-400">
          Selecciona una máquina para conocer sus especificaciones técnicas.
        </p>
      </div>

      {/* Grid */}
      <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
        {maquinas.map((maquina) => (
          <Link key={maquina.ruta} href={`/about/maquinas/${maquina.ruta}`} className="group">
            
            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-md shadow-xl transition duration-300 transform group-hover:scale-[1.03] group-hover:border-emerald-400/30">
              
              {/* Imagen */}
              <div className="relative w-full h-56">
                <Image
                  src={maquina.imagen}
                  alt={maquina.nombre}
                  fill
                  className="object-cover group-hover:scale-105 transition duration-500"
                />
                
                {/* Overlay oscuro */}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition duration-300" />
              </div>

              {/* Nombre */}
              <div className="p-6 text-center">
                <h2 className="text-lg font-semibold text-white">
                  {maquina.nombre}
                </h2>
              </div>

              {/* Glow inferior */}
              <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent opacity-0 group-hover:opacity-100 transition" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
