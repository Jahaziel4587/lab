"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../src/Context/AuthContext";
import { FiUser, FiBell } from "react-icons/fi";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/src/firebase/firebaseConfig";

type NotiItem = {
  id: string;
  mensaje: string;
  pedidoId?: string;
  tipo?: string;
  createdAt?: any;
  leido?: boolean;
  origen: "notifications" | "notifications_admin";
};

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin, displayName } = useAuth();

  const nombreUsuario = displayName || user?.email || "";

  // ---- Estado de notificaciones ----
  const [userNotis, setUserNotis] = useState<NotiItem[]>([]);
  const [adminNotis, setAdminNotis] = useState<NotiItem[]>([]);
  const [panelAbierto, setPanelAbierto] = useState(false);

  // merge de ambas listas (si es admin ve las dos) y ORDENAMOS AQUÍ
  const notificaciones = useMemo(() => {
    const base = [...userNotis, ...(isAdmin ? adminNotis : [])];
    return base.sort((a, b) => {
      const ta =
        a.createdAt?.toDate?.() instanceof Date
          ? a.createdAt.toDate().getTime()
          : 0;
      const tb =
        b.createdAt?.toDate?.() instanceof Date
          ? b.createdAt.toDate().getTime()
          : 0;
      return tb - ta; // más recientes primero
    });
  }, [userNotis, adminNotis, isAdmin]);

  const unreadCount = notificaciones.filter((n) => !n.leido).length;

  // ---- Suscripción a notificaciones de usuario (SIN orderBy) ----
  useEffect(() => {
    if (!user?.email) {
      setUserNotis([]);
      return;
    }

    const qNotiUser = query(
      collection(db, "notifications"),
      where("userEmail", "==", user.email)
      // SIN orderBy("createdAt")
    );

    const unsub = onSnapshot(
      qNotiUser,
      (snap) => {
        const arr: NotiItem[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          arr.push({
            id: d.id,
            mensaje: data.mensaje || "",
            pedidoId: data.pedidoId,
            tipo: data.tipo,
            createdAt: data.createdAt,
            leido: data.leido ?? false,
            origen: "notifications",
          });
        });
        setUserNotis(arr);
      },
      (err) => {
        console.error("Error escuchando notifications de usuario:", err);
      }
    );

    return () => unsub();
  }, [user?.email]);

  // ---- Suscripción a notificaciones de admins (también sin orderBy para evitar líos) ----
  useEffect(() => {
    if (!isAdmin) {
      setAdminNotis([]);
      return;
    }

    const qAdmin = query(
      collection(db, "notifications_admin")
      // SIN orderBy("createdAt")
    );

    const unsub = onSnapshot(
      qAdmin,
      (snap) => {
        const arr: NotiItem[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          arr.push({
            id: d.id,
            mensaje: data.mensaje || "",
            pedidoId: data.pedidoId,
            tipo: data.tipo,
            createdAt: data.createdAt,
            leido: data.leido ?? false,
            origen: "notifications_admin",
          });
        });
        setAdminNotis(arr);
      },
      (err) => {
        console.error("Error escuchando notifications_admin:", err);
      }
    );

    return () => unsub();
  }, [isAdmin]);

  // ---- Marcar todas como leídas cuando se abre el panel ----
  const marcarTodasLeidas = async () => {
    const pendientes = notificaciones.filter((n) => !n.leido);
    if (pendientes.length === 0) return;

    try {
      await Promise.all(
        pendientes.map((n) => {
          const ref = doc(db, n.origen, n.id);
          return updateDoc(ref, { leido: true });
        })
      );
    } catch (e) {
      console.error("Error marcando notificaciones como leídas:", e);
    }
  };

  const togglePanel = () => {
    setPanelAbierto((prev) => {
      const next = !prev;
      if (!prev && next) {
        marcarTodasLeidas();
      }
      return next;
    });
  };

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
          <Link href="/calendario" className="hover:underline">
            Calendario
          </Link>
          <Link href="/about" className="hover:underline">
            Información
          </Link>
          <Link href="/collection" className="hover:underline">
            Colección
          </Link>
          <Link href="/solicitudes" className="hover:underline">
            Mis proyectos
          </Link>
          <Link href="/hacer-pedido/proyecto" className="hover:underline">
            Hacer pedido
          </Link>
          <Link href="/inventario" className="hover:underline">
            Inventario
          </Link>

          {isAdmin && (
            <Link href="/cotizador" className="hover:underline">
              Cotizador
            </Link>
          )}
          {isAdmin && (
            <Link href="/analitica" className="hover:underline">
              Análisis
            </Link>
          )}

          {/* ---- Campana de notificaciones ---- */}
          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={togglePanel}
                className="relative w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200"
              >
                <FiBell />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold rounded-full px-1.5 py-[1px]">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {panelAbierto && (
                <div className="absolute right-0 mt-2 w-80 bg-white text-black rounded-xl shadow-lg z-30 p-3 max-h-96 overflow-y-auto text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">Notificaciones</span>
                    <button
                      type="button"
                      onClick={() => setPanelAbierto(false)}
                      className="text-[11px] text-gray-500 hover:text-black"
                    >
                      Cerrar
                    </button>
                  </div>

                  {notificaciones.length === 0 ? (
                    <p className="text-gray-500 text-xs">
                      No tienes notificaciones por el momento.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {notificaciones.map((n) => {
                        const fecha =
                          n.createdAt?.toDate?.() instanceof Date
                            ? n.createdAt.toDate()
                            : null;
                        const href = n.pedidoId
                          ? `/solicitudes/detalle/${n.pedidoId}`
                          : undefined;

                        const contenido = (
                          <div
                            className={`border rounded-lg px-2 py-1.5 ${
                              n.leido ? "bg-white" : "bg-gray-100"
                            }`}
                          >
                            <div className="text-[11px] leading-snug">
                              {n.mensaje}
                            </div>
                            {fecha && (
                              <div className="text-[9px] text-gray-500 mt-1">
                                {fecha.toLocaleDateString()}{" "}
                                {fecha.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            )}
                          </div>
                        );

                        return (
                          <li key={`${n.origen}-${n.id}`}>
                            {href ? (
                              <Link href={href} onClick={() => setPanelAbierto(false)}>
                                {contenido}
                              </Link>
                            ) : (
                              contenido
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {user && (
            <span className="text-xs font-semibold text-white mr-1">
              {nombreUsuario}
            </span>
          )}

          {/* Icono de usuario / login-logout */}
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
