"use client";
import Link from "next/link";

export default function ImpresionPage() {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 px-6 py-20">
      <h1 className="text-3xl font-bold text-center mb-10">Impresión</h1>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 max-w-4xl mx-auto">
        <Link href="/about/servicios/impresion/resina">
          <div className="bg-white p-6 rounded-lg shadow-md hover:bg-purple-100 hover:scale-105 transition cursor-pointer text-center">
            <h2 className="text-xl font-semibold text-purple-700">Resina</h2>
            <p className="text-sm mt-2 text-gray-600">Alta precisión, excelente acabado</p>
          </div>
        </Link>

        <Link href="/about/servicios/impresion/filamento">
          <div className="bg-white p-6 rounded-lg shadow-md hover:bg-blue-100 hover:scale-105 transition cursor-pointer text-center">
            <h2 className="text-xl font-semibold text-blue-700">Filamento</h2>
            <p className="text-sm mt-2 text-gray-600">Opciones como PLA, TPU, ABS</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
