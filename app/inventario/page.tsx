"use client";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/src/Context/AuthContext";

export default function InventarioPage() {
  const { isAdmin } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-20">
      <h1 className="text-3xl font-bold mb-10">Inventario</h1>

      <div
        className={`grid grid-cols-1 gap-10 ${
          isAdmin ? "md:grid-cols-3" : "md:grid-cols-2"
        }`}
      >
        {/* Tarjeta: Equipos y herramientas */}
        <Link href="/inventario/equipos" className="cursor-pointer">
          <div className="w-64 rounded-xl overflow-hidden shadow-lg transform hover:scale-105 transition bg-white">
            <Image
              src="/equipos.jfif"
              alt="Equipos y herramientas"
              width={300}
              height={400}
              className="object-cover w-full h-80"
              priority
            />
            <div className="p-4 text-center">
              <h2 className="text-xl font-semibold text-black">
                Equipos y herramientas
              </h2>
              <p className="text-sm text-gray-600 mt-1">Ver disponibles</p>
            </div>
          </div>
        </Link>

        {/* Tarjeta: Consumibles */}
        <Link href="/inventario/consumibles" className="cursor-pointer">
          <div className="w-64 rounded-xl overflow-hidden shadow-lg transform hover:scale-105 transition bg-white">
            <Image
              src="/servicio.jpg"
              alt="Consumibles"
              width={300}
              height={400}
              className="object-cover w-full h-80"
            />
            <div className="p-4 text-center">
              <h2 className="text-xl font-semibold text-black">Consumibles</h2>
              <p className="text-sm text-gray-600 mt-1">Explorar</p>
            </div>
          </div>
        </Link>

        {/* Tarjeta: Registros (solo admins) */}
        {isAdmin && (
          <Link href="/inventario/registros" className="cursor-pointer">
            <div className="w-64 rounded-xl overflow-hidden shadow-lg transform hover:scale-105 transition bg-white">
              {/* Usa una imagen si tienes, si no, deja un fondo gris */}
              <div className="w-full h-80 bg-gray-200 flex items-center justify-center">
                <span className="text-black/70 text-sm">Registros</span>
              </div>
              <div className="p-4 text-center">
                <h2 className="text-xl font-semibold text-black">Registros</h2>
                <p className="text-sm text-gray-600 mt-1">Historial de retiros</p>
              </div>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
