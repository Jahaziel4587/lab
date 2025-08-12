"use client";
import Link from "next/link";
import Image from "next/image";

export default function CortePage() {
  const opcionesCorte = [
    {
      nombre: "Corte Láser",
      descripcion: "Corte de alta precisión con láser CO₂.",
      ruta: "/about/servicios/corte/laser",
      imagen: "/laser.jpg",
    },
    {
      nombre: "Corte con Fresa",
      descripcion: "Ideal para materiales duros y cortes de gran escala.",
      ruta: "/about/servicios/corte/fresa",
      imagen: "/corte.jpg",
    },
  ];

  return (
    <div className="min-h-screen text-white-900 px-6 py-20">
      <h1 className="text-3xl font-bold text-center mb-10">Opciones de Corte</h1>
 {/* Botón de regreso */}
      <div className="max-w-6xl mx-auto mb-6">
        <button
          onClick={() => window.history.back()}
          className="mb-4 bg-white text-black px-4 py-2 rounded flex items-center gap-2 "
        >
          ← Regresar
        </button>
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 max-w-6xl mx-auto">
        {opcionesCorte.map((opcion, index) => (
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
                <p className="text-sm text-black-700">{opcion.descripcion}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
