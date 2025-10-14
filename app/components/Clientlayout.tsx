"use client";

import Link from "next/link";
import { useAuth } from "../../src/Context/AuthContext";
import { FiUser } from "react-icons/fi";


   export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin, displayName} = useAuth();



 const nombreUsuario = displayName || user?.email || "";

  const handleIconClick = async () => {
    if (user) {
      await logout();
    } else {
      window.location.href = "/login";
    }
  };
  return (
    <div
      className="min-h-screen text-white"
      style={{
        backgroundImage: "url('/fondo-bioana.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <header className="flex items-center justify-between px-8 py-4 bg-black text-white">
        <Link href="/" className="font-bold text-sm tracking-wider hover:underline">
          LABORATORIO DE PROTOTIPADO
        </Link>
  
        <div className="flex gap-6 items-center text-sm font-light">
          <Link href="/calendario" className="hover:underline">Calendario</Link>
          <Link href="/about" className="hover:underline">Información</Link>
          <Link href="/collection" className="hover:underline">Colección</Link>
          <Link href="/solicitudes" className="hover:underline">Mis proyectos</Link>
          <Link href="/hacer-pedido/proyecto" className="hover:underline">Hacer pedido</Link>
          <Link href="/inventario" className="hover:underline">Inventario</Link>
          {isAdmin && (
            <Link
              href="/cotizador"
              className="hover:underline"
            >
              Cotizador
            </Link>
          )}
      
          {user && (
            <span className="text-xs font-semibold text-white mr-1">
              {nombreUsuario}
            </span>
          )}

          <div className="relative group">
            <div
              onClick={handleIconClick}
              className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center cursor-pointer"
            >
              <FiUser />
            </div>

            <div className="absolute right-0 mt-2 hidden group-hover:flex flex-col z-20">
              <div className="bg-white text-black text-xs px-3 py-2 rounded shadow-md pointer-events-none">
                {user ? "Cerrar sesión" : "Iniciar sesión"}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="px-5 py-10">{children}</main>

      <footer className="text-center text-sm text-gray-400 py-4">
        © 2025 BIOANA. Todos los derechos reservados.
      </footer>
    </div>
  );
}
