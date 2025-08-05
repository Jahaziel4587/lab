"use client";
import Link from "next/link";

export default function ServiciosPage() {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 px-6 py-20">
      <h1 className="text-3xl font-bold text-center mb-10">Servicios</h1>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
        <Link href="/about/servicios/impresion">
          <div className="bg-white p-6 rounded-lg shadow-md hover:bg-blue-50 hover:scale-105 transition cursor-pointer text-center">
            <h2 className="text-xl font-semibold">Impresión</h2>
         
          </div>
        </Link>

        <Link href="/about/servicios/corte">
          <div className="bg-white p-6 rounded-lg shadow-md hover:bg-blue-50 hover:scale-105 transition cursor-pointer text-center">
            <h2 className="text-xl font-semibold">Corte</h2>
          
          </div>
        </Link>

        <Link href="/about/servicios/fixture">
          <div className="bg-white p-6 rounded-lg shadow-md hover:bg-blue-50 hover:scale-105 transition cursor-pointer text-center">
            <h2 className="text-xl font-semibold">Fixture</h2>
           
          </div>
        </Link>
      </div>
    </div>
  );
}
