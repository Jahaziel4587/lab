"use client";
import Link from "next/link";
import Image from "next/image";

export default function ServiciosPage() {
  const servicios = [
    {
      nombre: "Impresión",
      ruta: "/about/servicios/impresion",
      imagen: "/impresion3D.jpg",
    },
    {
      nombre: "Corte",
      ruta: "/about/servicios/corte",
      imagen: "/corte.jpg",
    },
    {
      nombre: "Fixture",
      ruta: "/about/servicios/fixture",
      imagen: "/fixture.jpg",
    },
  ];

  return (
    <div className="min-h-screen text-white-900 px-6 py-20">
      <h1 className="text-3xl font-bold text-center mb-10">Servicios</h1>
{/* Botón de regreso */}
      <div className="max-w-6xl mx-auto mb-6">
        <button
          onClick={() => window.history.back()}
          className="mb-4 bg-white text-black px-4 py-2 rounded flex items-center gap-2 hover:bg-gray-800"
        >
          ← Regresar
        </button>
      </div>
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
        {servicios.map((servicio, index) => (
          <Link href={servicio.ruta} key={index}>
            <div className="bg-white text-black rounded-xl overflow-hidden shadow-lg transform hover:scale-105 transition cursor-pointer">
              <Image
                src={servicio.imagen}
                alt={servicio.nombre}
                width={400}
                height={300}
                className="object-cover w-full h-64"
              />
              <div className="p-4 text-center">
                <h2 className="text-xl font-semibold">{servicio.nombre}</h2>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
