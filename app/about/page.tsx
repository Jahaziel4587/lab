"use client";
import Link from "next/link";
import Image from "next/image";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 flex flex-col items-center justify-center px-6 py-20">
      <h1 className="text-3xl font-bold mb-10">Información</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <Link href="/about/maquinas" className="group relative cursor-pointer">
          <div className="w-64 h-96 rounded-xl overflow-hidden shadow-lg transform group-hover:scale-105 transition">
            <Image
              src="/cnc.jpg" // ✅ asegúrate de tener esta imagen en /public
              alt="Máquinas"
              width={300}
              height={400}
              className="object-cover w-full h-full"
            />
            <div className="absolute inset-0 bg-black bg-opacity-40 flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 transition">
              <h2 className="text-xl font-semibold text-white">Máquinas</h2>
              <p className="text-sm text-gray-200 mt-1">Ver disponibles</p>
            </div>
          </div>
        </Link>

        <Link href="/about/servicios" className="group relative cursor-pointer">
          <div className="w-64 h-96 rounded-xl overflow-hidden shadow-lg transform group-hover:scale-105 transition">
            <Image
              src="/fixture.jpg" // ✅ asegúrate de tener esta imagen en /public
              alt="Servicios"
              width={300}
              height={400}
              className="object-cover w-full h-full"
            />
            <div className="absolute inset-0 bg-black bg-opacity-40 flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 transition">
              <h2 className="text-xl font-semibold text-white">Servicios</h2>
              <p className="text-sm text-gray-200 mt-1">Explorar</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

