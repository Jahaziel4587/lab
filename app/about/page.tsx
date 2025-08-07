"use client";
import Link from "next/link";
import Image from "next/image";

export default function AboutPage() {
  return (
    <div className="min-h-screen text-white-900 flex flex-col items-center justify-center px-6 py-20">
      <h1 className="text-3xl font-bold mb-10">Información</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Tarjeta de Máquinas */}
        <Link href="/about/maquinas" className="cursor-pointer">
          <div className="w-64 rounded-xl overflow-hidden shadow-lg transform hover:scale-105 transition bg-white">
            <Image
              src="/maquinas.jpg"
              alt="Máquinas"
              width={300}
              height={400}
              className="object-cover w-full h-80"
            />
            <div className="p-4 text-center">
              <h2 className="text-xl font-semibold text-black">Máquinas</h2>
              <p className="text-sm text-gray-600 mt-1">Ver disponibles</p>
            </div>
          </div>
        </Link>

        {/* Tarjeta de Servicios */}
        <Link href="/about/servicios" className="cursor-pointer">
          <div className="w-64 rounded-xl overflow-hidden shadow-lg transform hover:scale-105 transition bg-white">
            <Image
              src="/servicio.jpg"
              alt="Servicios"
              width={300}
              height={400}
              className="object-cover w-full h-80"
            />
            <div className="p-4 text-center">
              <h2 className="text-xl font-semibold text-black">Servicios</h2>
              <p className="text-sm text-gray-600 mt-1">Explorar</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
