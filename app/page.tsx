"use client";
import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";

export default function Home() {
  return (
    <div
      className="min-h-screen text-white flex flex-col"
      style={{
        backgroundImage: "url('/fondo-bioana.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-grow flex flex-col items-start justify-center px1 py1 text-left">
        <img
          src="/logo-completo.JPG"
          alt="Logo bioana"
          className="w-[700px] mb-4"
        />
        <div className="bg-black text-white rounded-xl p-6 max-w-4xl w-full flex justify-between items-center text-sm">
          <p className="text-left">
            Esta plataforma ha sido diseñada para facilitar y agilizar el proceso de
            solicitud de prototipos dentro de la empresa. Aquí podrás registrar nuevos
            pedidos, dar seguimiento a su desarrollo y mantener una comunicación fluida
            con los equipos responsables.
          </p>
          <Link href="/about/servicios">
            <button className="ml-6 w-12 h-12 border-2 border-white rounded-full flex items-center justify-center hover:bg-white hover:text-black transition">
              <FiArrowRight size={20} />
            </button>
          </Link>
        </div>
      </main>
    </div>
  );
}

