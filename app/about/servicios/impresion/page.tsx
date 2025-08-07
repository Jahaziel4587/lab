"use client";
import Link from "next/link";
import Image from "next/image";

export default function ImpresionPage() {
  const opcionesImpresion = [
    {
      nombre: "Resina",
      descripcion: "Alta precisión, excelente acabado",
      ruta: "/about/servicios/impresion/resina",
      imagen: "/resinas.png",
    },
    {
      nombre: "Filamento",
      descripcion: "Opciones como PLA, TPU, ABS",
      ruta: "/about/servicios/impresion/filamento",
      imagen: "/filamentos.jpg",
    },
  ];

  return (
    <div className="min-h-screen  text-white-900 px-6 py-20">
      <h1 className="text-3xl font-bold text-center mb-10">Impresión</h1>

      {/* Botón de regreso */}
      <div className="max-w-6xl mx-auto mb-6">
        <button
          onClick={() => window.history.back()}
          className="mb-4 bg-white text-black px-4 py-2 rounded flex items-center gap-2 hover:bg-gray-800"
        >
          ← Regresar
        </button>
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 max-w-4xl mx-auto">
        {opcionesImpresion.map((opcion, index) => (
          <Link href={opcion.ruta} key={index}>
            <div className="bg-white text-black rounded-xl overflow-hidden shadow-lg transform hover:scale-105 transition cursor-pointer">
              <Image
                src={opcion.imagen}
                alt={opcion.nombre}
                width={400}
                height={300}
                className="object-cover w-full h-64"
              />
              <div className="p-4 text-center">
                <h2 className="text-xl font-semibold mb-2">{opcion.nombre}</h2>
                <p className="text-sm text-gray-700">{opcion.descripcion}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
