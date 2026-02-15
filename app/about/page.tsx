"use client";
import Link from "next/link";
import { Wrench, Layers3, ArrowRight } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-24 text-white">
      {/* Encabezado */}
      <div className="text-center max-w-2xl mb-16">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Información del Laboratorio
        </h1>
        <p className="mt-4 text-gray-300 text-lg">
          Conoce los equipos disponibles y cómo entendemos el proceso de prototipado en Bioana.
        </p>
      </div>

      {/* Tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 w-full max-w-5xl">
        {/* Equipos */}
        <Link href="/about/maquinas" className="group">
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl overflow-hidden transition duration-300 transform group-hover:scale-[1.02] group-hover:border-emerald-400/30">
            <div className="p-8">
              {/* Icono */}
              <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center">
                <Wrench className="w-7 h-7 text-emerald-300" />
              </div>

              <h2 className="mt-6 text-2xl font-semibold text-white text-center">
                Equipos
              </h2>

              <p className="mt-3 text-center text-sm text-gray-300 leading-relaxed">
                Explora las máquinas disponibles para fabricación, corte, impresión 3D y mecanizado.
              </p>

              <div className="mt-7 flex items-center justify-center gap-2 text-sm font-medium text-emerald-300">
                <span>Ver disponibles</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            </div>

            {/* Línea inferior hover */}
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent opacity-0 group-hover:opacity-100 transition" />
          </div>
        </Link>

        {/* Prototipado */}
        <Link href="/about/prototipado" className="group">
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl overflow-hidden transition duration-300 transform group-hover:scale-[1.02] group-hover:border-emerald-400/30">
            <div className="p-8">
              {/* Icono */}
              <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center">
                <Layers3 className="w-7 h-7 text-emerald-300" />
              </div>

              <h2 className="mt-6 text-2xl font-semibold text-white text-center">
                Prototipado
              </h2>

              <p className="mt-3 text-center text-sm text-gray-300 leading-relaxed">
                Descubre cómo transformamos ideas en prototipos funcionales mediante un proceso estructurado.
              </p>

              <div className="mt-7 flex items-center justify-center gap-2 text-sm font-medium text-emerald-300">
                <span>Explorar proceso</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            </div>

            {/* Línea inferior hover */}
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent opacity-0 group-hover:opacity-100 transition" />
          </div>
        </Link>
      </div>
    </div>
  );
}
