"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import {
  FiBriefcase,
  FiLogOut,
  FiShield,
  FiTool,
  FiUser,
} from "react-icons/fi";

import { useAuth } from "@/src/Context/AuthContext";
import { db } from "@/src/firebase/firebaseConfig";

type AccountData = {
  email?: string;
  nombre?: string;
  apellido?: string;
  displayName?: string;
  role?: "admin" | "user" | string;
  pmProjects?: string[];
  isDesigner?: boolean;
  processOwnerOf?: string[];
  createdAt?: any;
};

function formatCreatedAt(value: any) {
  const date =
    value?.toDate?.() instanceof Date
      ? value.toDate()
      : value instanceof Date
        ? value
        : null;

  if (!date) return "No disponible";

  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatProcessName(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const processNames: Record<string, string> = {
    produccion: "Producción",
    "inspeccion / calidad": "Inspección / Calidad",
    "inspeccion/calidad": "Inspección / Calidad",
    inspeccion: "Inspección / Calidad",
    calidad: "Inspección / Calidad",
    capacitacion: "Capacitación",
    "r&d": "R&D",
    ryd: "R&D",
    "v&v": "V&V",
    vyv: "V&V",
    validacion: "V&V",
    prueba: "Prueba",
  };

  return processNames[normalized] || value;
}

export default function CuentaPage() {
  const router = useRouter();
  const {
    user,
    logout,
    isAdmin,
    displayName,
    loading: authLoading,
  } = useAuth();

  const [accountData, setAccountData] =
    useState<AccountData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    const loadAccountData = async () => {
      try {
        setLoadingData(true);

        const userSnapshot = await getDoc(
          doc(db, "users", user.uid),
        );

        if (userSnapshot.exists()) {
          setAccountData(
            userSnapshot.data() as AccountData,
          );
        } else {
          setAccountData(null);
        }
      } catch (error) {
        console.error(
          "No fue posible cargar la información de la cuenta:",
          error,
        );
        setAccountData(null);
      } finally {
        setLoadingData(false);
      }
    };

    loadAccountData();
  }, [user, authLoading, router]);

  const fullName = useMemo(() => {
    const nameFromFirestore = [
      accountData?.nombre,
      accountData?.apellido,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    return (
      nameFromFirestore ||
      accountData?.displayName ||
      displayName ||
      user?.displayName ||
      "Usuario"
    );
  }, [accountData, displayName, user?.displayName]);

  const pmProjects = Array.isArray(
    accountData?.pmProjects,
  )
    ? accountData.pmProjects
    : [];

  const processOwnerOf = Array.isArray(
    accountData?.processOwnerOf,
  )
    ? accountData.processOwnerOf
    : [];

  const roles = useMemo(() => {
    const result: string[] = [];

    if (isAdmin || accountData?.role === "admin") {
      result.push("Administrador");
    } else {
      result.push("Usuario");
    }

    if (accountData?.isDesigner === true) {
      result.push("Diseñador");
    }

    if (processOwnerOf.length > 0) {
      result.push("Encargado de proceso");
    }

    if (pmProjects.length > 0) {
      result.push("Project Manager");
    }

    return result;
  }, [
    isAdmin,
    accountData?.role,
    accountData?.isDesigner,
    processOwnerOf.length,
    pmProjects.length,
  ]);

  const handleLogout = async () => {
    const confirmed = window.confirm(
      "¿Estás seguro de que quieres cerrar sesión?",
    );

    if (!confirmed) return;

    try {
      setLoggingOut(true);
      await logout();
    } catch (error) {
      console.error(
        "No fue posible cerrar la sesión:",
        error,
      );

      window.alert(
        "No fue posible cerrar la sesión. Inténtalo nuevamente.",
      );

      setLoggingOut(false);
    }
  };

  if (authLoading || loadingData) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-10 text-center text-sm text-white/60 backdrop-blur-xl">
          Cargando información de la cuenta...
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 text-white sm:px-8 sm:py-12">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-xl">
        <div className="border-b border-white/10 p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-emerald-300/20 bg-emerald-400/10 text-2xl text-emerald-300">
              <FiUser />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300/80">
                Mi cuenta
              </p>

              <h1 className="mt-2 truncate text-2xl font-semibold sm:text-3xl">
                {fullName}
              </h1>

              <p className="mt-1 truncate text-sm text-white/55">
                {user.email}
              </p>
            </div>
          </div>
        </div>

     

          <section className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:col-span-2">
            <div className="flex items-center gap-3 text-white/55">
              <FiShield />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Roles
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {roles.map((role) => (
                <span
                  key={role}
                  className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-100"
                >
                  {role}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:col-span-2">
            <div className="flex items-center gap-3 text-white/55">
              <FiBriefcase />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Proyectos asignados como PM
              </span>
            </div>

            {pmProjects.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 p-4 sm:grid-cols-2 sm:gap-7 sm:p-8">
                {[...pmProjects]
                  .sort((a, b) => a.localeCompare(b))
                  .map((project) => (
                    <div
                      key={project}
                      className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white/85"
                    >
                      {project}
                    </div>
                  ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-white/50">
                Esta cuenta no tiene proyectos asignados como PM.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:col-span-2">
            <div className="flex items-center gap-3 text-white/55">
              <FiTool />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Permisos adicionales
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
                <span className="text-sm text-white/65">
                  Diseñador de fixtures
                </span>

                <span
                  className={
                    accountData?.isDesigner
                      ? "text-sm font-semibold text-emerald-300"
                      : "text-sm text-white/40"
                  }
                >
                  {accountData?.isDesigner ? "Sí" : "No"}
                </span>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
                <p className="text-sm text-white/65">
                  Procesos asignados como encargado
                </p>

                {processOwnerOf.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                   {processOwnerOf.map((process) => (
                    <span
                        key={process}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/80"
                    >
                        {formatProcessName(process)}
                    </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-white/40">
                    Ninguno
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
              Miembro desde
            </p>

            <p className="mt-2 text-sm text-white/80">
              {formatCreatedAt(accountData?.createdAt)}
            </p>
          </section>
        </div>

        <div className="border-t border-white/10 p-4 sm:p-8">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-3 font-semibold text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <FiLogOut />

            {loggingOut
              ? "Cerrando sesión..."
              : "Cerrar sesión"}
          </button>
        </div>
      </div>
    
  );
}