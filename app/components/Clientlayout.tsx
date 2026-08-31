"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../src/Context/AuthContext";
import { FiUser, FiBell, FiMenu, FiX } from "react-icons/fi";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/src/firebase/firebaseConfig";
import PushNotificationSetup from "./PushNotificationSetup";
import ParticlesBackground from "../components/ParticlesBackground";

type NotiItem = {
  id: string;
  mensaje: string;
  pedidoId?: string;
  tipo?: string;
  createdAt?: any;
  leido?: boolean;
  origen: "notifications" | "notifications_admin";
};

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, isAdmin, displayName } = useAuth();
  const nombreUsuario = displayName || user?.email || "";

  const [userNotis, setUserNotis] = useState<NotiItem[]>([]);
  const [adminNotis, setAdminNotis] = useState<NotiItem[]>([]);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

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
      return tb - ta;
    });
  }, [userNotis, adminNotis, isAdmin]);

  const unreadCount = notificaciones.filter((n) => !n.leido).length;

  useEffect(() => {
    if (!user?.email) {
      setUserNotis([]);
      return;
    }

    const qNotiUser = query(
      collection(db, "notifications"),
      where("userEmail", "==", user.email),
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
      (err) =>
        console.error("Error escuchando notifications de usuario:", err),
    );

    return () => unsub();
  }, [user?.email]);

  useEffect(() => {
    if (!isAdmin) {
      setAdminNotis([]);
      return;
    }

    const qAdmin = query(collection(db, "notifications_admin"));
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
      (err) =>
        console.error("Error escuchando notifications_admin:", err),
    );

    return () => unsub();
  }, [isAdmin]);

  const marcarTodasLeidas = async () => {
    const pendientes = notificaciones.filter((n) => !n.leido);
    if (pendientes.length === 0) return;

    try {
      await Promise.all(
        pendientes.map((n) => {
          const ref = doc(db, n.origen, n.id);
          return updateDoc(ref, { leido: true });
        }),
      );
    } catch (e) {
      console.error("Error marcando notificaciones como leídas:", e);
    }
  };

  const togglePanel = () => {
    setMenuAbierto(false);
    setPanelAbierto((prev) => {
      const next = !prev;
      if (!prev && next) marcarTodasLeidas();
      return next;
    });
  };

  const toggleMenu = () => {
    setPanelAbierto(false);
    setMenuAbierto((prev) => !prev);
  };

  const cerrarMenu = () => setMenuAbierto(false);

  const handleIconClick = async () => {
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const confirmarCierre = window.confirm(
      "¿Estás seguro de que quieres cerrar sesión?",
    );

    if (!confirmarCierre) return;

    try {
      await logout();
    } catch (error) {
      console.error("No fue posible cerrar la sesión:", error);
      window.alert(
        "No fue posible cerrar la sesión. Inténtalo nuevamente.",
      );
    }
  };

  const mobileLinkClass =
    "min-h-12 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white/75 transition hover:bg-white/[0.07] hover:text-white active:bg-white/[0.10] flex items-center";

  return (
    <div className="min-h-screen text-white relative bg-neutral-950 overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-56 -left-56 h-[720px] w-[720px] rounded-full bg-emerald-400/14 blur-3xl" />
        <div className="absolute -top-40 -right-64 h-[760px] w-[760px] rounded-full bg-teal-400/12 blur-3xl" />
        <div className="absolute -bottom-64 left-1/3 h-[760px] w-[760px] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-black/55" />
        <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.65)_70%,rgba(0,0,0,0.85)_100%)]" />

        <div className="pointer-events-none absolute inset-0 z-0">
          <ParticlesBackground />
        </div>

        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 3px)",
          }}
        />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/55 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link
            href="/"
            onClick={cerrarMenu}
            className="min-w-0 shrink font-semibold tracking-wider text-white/90 hover:text-white transition"
          >
            <span className="hidden sm:inline text-sm">
              BIOANA PROTOTYPING LAB
            </span>
            <span className="sm:hidden text-[11px] leading-tight whitespace-nowrap">
              BIOANA PROTOLAB
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-6 text-sm text-white/75">
            <Link
              data-tutorial="nav-calendar"
              href="/calendario"
              className="hover:text-white transition"
            >
              Order Overview
            </Link>
            <Link
              data-tutorial="nav-about"
              href="/about"
              className="hover:text-white transition"
            >
              Information
            </Link>
            <Link
              data-tutorial="nav-projects"
              href="/solicitudes"
              className="hover:text-white transition"
            >
              My Projects
            </Link>
            <Link
              data-tutorial="nav-place-order"
              href="/hacer-pedido/proyecto"
              className="hover:text-white transition"
            >
              Place Order
            </Link>

            {isAdmin && (
              <Link
                data-tutorial="nav-quoter"
                href="/cotizador"
                className="hover:text-white transition"
              >
                Quoter
              </Link>
            )}

            <Link
              data-tutorial="nav-analytics"
              href="/analitica"
              className="hover:text-white transition"
            >
              Analytics
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {user && (
              <div className="relative">
                <button
                  type="button"
                  onClick={togglePanel}
                  aria-label="Abrir notificaciones"
                  aria-expanded={panelAbierto}
                  className="relative w-11 h-11 sm:w-9 sm:h-9 rounded-2xl border border-white/10 bg-white/[0.04] text-white flex items-center justify-center hover:bg-white/[0.07] active:bg-white/[0.10] transition"
                >
                  <FiBell />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold rounded-full px-1.5 py-[1px]">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {panelAbierto && (
                  <div className="fixed left-3 right-3 top-[calc(4.25rem+env(safe-area-inset-top))] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 rounded-2xl border border-white/10 bg-black/95 sm:bg-black/80 backdrop-blur-xl shadow-2xl z-50 p-3 max-h-[70dvh] sm:max-h-96 overflow-y-auto text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-white">
                        Notificaciones
                      </span>
                      <button
                        type="button"
                        onClick={() => setPanelAbierto(false)}
                        className="min-h-10 px-2 text-[11px] text-white/60 hover:text-white transition"
                      >
                        Cerrar
                      </button>
                    </div>

                    <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <PushNotificationSetup />
                    </div>

                    {notificaciones.length === 0 ? (
                      <p className="text-white/60 text-xs py-2">
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
                            ? `/solicitudes/listado/${n.pedidoId}`
                            : undefined;

                          const contenido = (
                            <div
                              className={`rounded-xl border border-white/10 px-3 py-3 ${
                                n.leido
                                  ? "bg-white/[0.03]"
                                  : "bg-white/[0.06]"
                              }`}
                            >
                              <div className="text-[11px] leading-relaxed text-white/90">
                                {n.mensaje}
                              </div>
                              {fecha && (
                                <div className="text-[10px] text-white/55 mt-1.5">
                                  {fecha.toLocaleDateString()} {" "}
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
                                <Link
                                  href={href}
                                  onClick={() => setPanelAbierto(false)}
                                >
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
              <span className="hidden sm:inline max-w-44 truncate text-xs font-semibold text-white/80">
                {nombreUsuario}
              </span>
            )}

            <div className="relative group">
              <button
                type="button"
                onClick={handleIconClick}
                aria-label={user ? "Cerrar sesión" : "Iniciar sesión"}
                title={user ? "Cerrar sesión" : "Iniciar sesión"}
                className="w-11 h-11 sm:w-9 sm:h-9 rounded-2xl border border-white/10 bg-white/[0.04] text-white flex items-center justify-center hover:bg-white/[0.07] active:bg-white/[0.10] transition"
              >
                <FiUser />
              </button>

              <div className="absolute right-0 mt-2 hidden group-hover:flex flex-col z-50">
                <div className="bg-black/80 backdrop-blur-xl border border-white/10 text-white text-xs px-3 py-2 rounded-xl shadow-lg pointer-events-none whitespace-nowrap">
                  {user ? "Cerrar sesión" : "Iniciar sesión"}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleMenu}
              aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={menuAbierto}
              className="lg:hidden w-11 h-11 sm:w-9 sm:h-9 rounded-2xl border border-white/10 bg-white/[0.04] text-white flex items-center justify-center hover:bg-white/[0.07] active:bg-white/[0.10] transition"
            >
              {menuAbierto ? <FiX size={20} /> : <FiMenu size={20} />}
            </button>
          </div>
        </div>

        {menuAbierto && (
          <div className="lg:hidden border-t border-white/10 bg-black/45 px-3 sm:px-4 py-3 sm:py-4">
            <nav className="grid grid-cols-1 min-[390px]:grid-cols-2 gap-2 text-sm">
              <Link
                href="/calendario"
                onClick={cerrarMenu}
                className={mobileLinkClass}
              >
                Order Overview
              </Link>

              <Link
                href="/about"
                onClick={cerrarMenu}
                className={mobileLinkClass}
              >
                Information
              </Link>

              <Link
                href="/solicitudes"
                onClick={cerrarMenu}
                className={mobileLinkClass}
              >
                My Projects
              </Link>

              <Link
                href="/hacer-pedido/proyecto"
                onClick={cerrarMenu}
                className="min-h-12 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-emerald-300 hover:bg-emerald-400/15 active:bg-emerald-400/20 transition flex items-center"
              >
                Place Order
              </Link>

              {isAdmin && (
                <Link
                  href="/cotizador"
                  onClick={cerrarMenu}
                  className={mobileLinkClass}
                >
                  Quoter
                </Link>
              )}

              <Link
                href="/analitica"
                onClick={cerrarMenu}
                className={mobileLinkClass}
              >
                Analytics
              </Link>
            </nav>

            {user && nombreUsuario && (
              <div className="sm:hidden mt-3 pt-3 border-t border-white/10 text-[11px] text-white/50 truncate">
                Sesión: {nombreUsuario}
              </div>
            )}
          </div>
        )}
      </header>

      <main className="relative z-10 px-0">{children}</main>

      <footer className="relative z-0 text-center text-xs text-white/45 px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pointer-events-none">
        © 2025 BIOANA. Todos los derechos reservados.
      </footer>
    </div>
  );
}
