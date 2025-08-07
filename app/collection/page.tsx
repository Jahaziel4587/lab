"use client";
import Link from "next/link";
import Image from "next/image";

export default function CollectionPage() {
  const secciones = [
    {
      nombre: "Corte",
      ruta: "/collection/corte",
      imagen: "/corte.jpg",
    },
    {
      nombre: "Fixture",
      ruta: "/collection/fixture",
      imagen: "/fixture.jpg",
    },
    {
      nombre: "Impresión",
      ruta: "/collection/impresion",
      imagen: "/impresion3D.jpg",
    },
    {
      nombre: "Necesidad",
      ruta: "/collection/necesidad",
      imagen: "/fixture-no-diseñado.jpg",
    },
  ];

  return (
    <div className="min-h-screen  text-white-900 px-6 py-20">
      <h1 className="text-3xl font-bold text-center mb-10">Colección de Proyectos</h1>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
        {secciones.map((item, index) => (
          <Link href={item.ruta} key={index}>
            <div className="bg-white text-black rounded-xl overflow-hidden shadow-md transform hover:scale-105 transition cursor-pointer">
              <Image
                src={item.imagen}
                alt={item.nombre}
                width={400}
                height={300}
                className="object-cover w-full h-60"
              />
              <div className="p-4 text-center">
                <h2 className="text-xl font-semibold">{item.nombre}</h2>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}


