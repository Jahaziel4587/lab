"use client";
import Link from "next/link";

export default function CortePage() {
  return (
    <div className="flex flex-col items-center gap-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Opciones de Corte</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Link href="/about/servicios/corte/laser">
          <div className="bg-black bg-opacity-60 p-6 rounded-xl cursor-pointer hover:bg-opacity-80 transition">
            <h2 className="text-xl font-semibold">Corte Láser</h2>
            <p className="text-sm mt-2">Corte de alta precisión con láser CO₂.</p>
          </div>
        </Link>
        <Link href="/about/servicios/corte/fresa">
          <div className="bg-black bg-opacity-60 p-6 rounded-xl cursor-pointer hover:bg-opacity-80 transition">
            <h2 className="text-xl font-semibold">Corte con Fresa</h2>
            <p className="text-sm mt-2">Ideal para materiales duros y cortes de gran escala.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}