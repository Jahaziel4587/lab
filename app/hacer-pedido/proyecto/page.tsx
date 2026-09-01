"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowRight, FiSearch, FiSliders } from "react-icons/fi";
import { auth } from "@/src/firebase/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import OrderFlowHeader from "../components/OrderFlowHeader";

type Proyecto = {
  nombre: string;
  imagen: string;
};

const proyectos: Proyecto[] = [
  { nombre: "001.Ocumetics", imagen: "/ocumetics.jpeg" },
  { nombre: "002.Labella", imagen: "/Bioana.jpeg" },
  { nombre: "004.Solvein", imagen: "/Bioana.jpeg" },
  { nombre: "005.XSONXS Wound Heads", imagen: "/XSONX.png" },
  { nombre: "006.AGMI", imagen: "/Bioana.jpeg" },
  { nombre: "007.LumeNXT", imagen: "/LumeNXT.jpg" },
  { nombre: "008.Panter", imagen: "/Bioana.jpeg" },
  { nombre: "009.Recopad", imagen: "/Bioana.jpeg" },
  { nombre: "010.Juno", imagen: "/Bioana.jpeg" },
  { nombre: "013.T-EZ", imagen: "/Bioana.jpeg" },
  { nombre: "014.QIKCap handle", imagen: "/Bioana.jpeg" },
  { nombre: "015.QIKCap disposible", imagen: "/Bioana.jpeg" },
  { nombre: "016.Portacad shield", imagen: "/Bioana.jpeg" },
  { nombre: "017.JNM", imagen: "/Bioana.jpeg" },
  { nombre: "020.Hero Cap", imagen: "/Bioana.jpeg" },
  { nombre: "027.XSCRUB", imagen: "/XSCRUB.jpeg" },
  { nombre: "036.Scalp Clip gun", imagen: "/XSCRUB.jpeg" },
  { nombre: "038.Peritoneal introducer", imagen: "/XSCRUB.jpeg" },
  { nombre: "030.MUV", imagen: "/Bioana.jpeg" },
  { nombre: "E011.Orthodoxo Anclas", imagen: "/Bioana.jpeg" },
  { nombre: "E012.Falcon View", imagen: "/Bioana.jpeg" },
  { nombre: "E018.Sleep Fascia", imagen: "/Bioana.jpeg" },
  { nombre: "E019.Orthotek", imagen: "/Bioana.jpeg" },
  { nombre: "E022.Injectable Dermis", imagen: "/Bioana.jpeg" },
  { nombre: "E023.DiViDiaper", imagen: "/Bioana.jpeg" },
  { nombre: "E025.InjectMate", imagen: "/Bioana.jpeg" },
  { nombre: "E026.Birchconcepts", imagen: "/Bioana.jpeg" },
  { nombre: "E028.Peniflex", imagen: "/Bioana.jpeg" },
  { nombre: "E029.Zipstich", imagen: "/Bioana.jpeg" },
  { nombre: "E031.Orthodoxo Cople", imagen: "/Bioana.jpeg" },
  { nombre: "E033.Sport Care Blister Packaging", imagen: "/Bioana.jpeg" },
  { nombre: "E034.Sage guard", imagen: "/Bioana.jpeg" },
  { nombre: "E035.Sheplus", imagen: "/Bioana.jpeg" },
  { nombre: "E036.OsteoOne", imagen: "/Bioana.jpeg" },
  { nombre: "E037.CAFE", imagen: "/Bioana.jpeg" },
  { nombre: "Otro", imagen: "/otro.jpg" },
];

function splitProyectoLabel(full: string) {
  const dotIdx = full.indexOf(".");
  if (dotIdx > 0) {
    const code = full.slice(0, dotIdx).trim();
    const name = full.slice(dotIdx + 1).trim();
    return { code, name: name || full };
  }

  const firstSpace = full.indexOf(" ");
  if (firstSpace > 0) {
    const maybeCode = full.slice(0, firstSpace).trim();
    const name = full.slice(firstSpace + 1).trim();
    return { code: maybeCode, name: name || full };
  }

  return { code: full, name: "" };
}

export default function ProyectoPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [hiddenProjects, setHiddenProjects] = useState<string[]>([]);
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterSelection, setFilterSelection] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const key = user?.uid ? `hiddenProjects_${user.uid}` : "hiddenProjects_guest";
      setStorageKey(key);

      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(key);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) setHiddenProjects(parsed);
          } catch (error) {
            console.error("Error leyendo hiddenProjects de localStorage", error);
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const seleccionarProyecto = (nombre: string) => {
    localStorage.setItem("proyecto", nombre);
    router.push("/hacer-pedido/servicios");
  };

  const abrirFiltro = () => {
    const initial: Record<string, boolean> = {};
    proyectos.forEach((p) => {
      initial[p.nombre] = !hiddenProjects.includes(p.nombre);
    });
    setFilterSelection(initial);
    setFilterSearch("");
    setIsFilterOpen(true);
  };

  const toggleSeleccionProyecto = (nombre: string) => {
    setFilterSelection((prev) => ({ ...prev, [nombre]: !prev[nombre] }));
  };

  const seleccionarTodo = (valor: boolean) => {
    const next: Record<string, boolean> = {};
    proyectos.forEach((p) => {
      next[p.nombre] = valor;
    });
    setFilterSelection(next);
  };

  const aplicarFiltro = () => {
    const nextHidden = proyectos
      .filter((p) => !filterSelection[p.nombre])
      .map((p) => p.nombre);

    setHiddenProjects(nextHidden);

    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(nextHidden));
    }

    setIsFilterOpen(false);
  };

  const proyectosFiltrados = proyectos.filter((p) => {
    if (hiddenProjects.includes(p.nombre)) return false;
    return p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-8">
      <OrderFlowHeader
        step={1}
        title="Selecciona tu proyecto"
        description="Elige el proyecto al que pertenece esta solicitud."
        onBack={() => router.push("/")}
      />

      <div className="mb-4 flex items-center gap-2 sm:mb-6">
        <div className="relative min-w-0 flex-1">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Buscar proyecto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-emerald-300/30 focus:ring-2 focus:ring-emerald-400/20 sm:h-11 sm:max-w-md"
          />
        </div>

        <button
          type="button"
          onClick={abrirFiltro}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm text-white/80 transition hover:bg-white/10 sm:h-11 sm:px-4"
          aria-label="Filtrar proyectos"
        >
          <FiSliders />
          <span className="hidden sm:inline">Filtrar proyectos</span>
        </button>
      </div>

      {/* Móvil: lista compacta para recorrer proyectos rápidamente. */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] sm:hidden">
        <div className="divide-y divide-white/10">
          {proyectosFiltrados.map((p) => {
            const { code, name } = splitProyectoLabel(p.nombre);
            return (
              <button
                key={p.nombre}
                type="button"
                onClick={() => seleccionarProyecto(p.nombre)}
                className="flex min-h-[66px] w-full items-center gap-3 px-3.5 py-3 text-left active:bg-white/[0.07]"
              >
                <span className="w-[58px] shrink-0 text-lg font-bold tracking-tight text-emerald-300">
                  {code}
                </span>
                <span className="min-w-0 flex-1 break-words text-sm font-medium leading-snug text-white/90">
                  {name || p.nombre}
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/55">
                  <FiArrowRight />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tablet / escritorio: conserva las tarjetas amplias. */}
      <div className="hidden grid-cols-2 gap-5 sm:grid md:grid-cols-3">
        {proyectosFiltrados.map((p) => {
          const { code, name } = splitProyectoLabel(p.nombre);
          return (
            <button
              key={p.nombre}
              onClick={() => seleccionarProyecto(p.nombre)}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left shadow-lg backdrop-blur-md transition hover:bg-white/10 hover:shadow-xl"
            >
              <div className="flex h-40 items-center justify-between gap-4 p-6">
                <div className="min-w-0">
                  <div className="text-4xl font-extrabold tracking-tight text-emerald-300 md:text-5xl">
                    {code}
                  </div>
                  <div className="mt-1 truncate text-base font-semibold text-white md:text-lg">
                    {name || p.nombre}
                  </div>
                  <div className="mt-2 text-xs text-white/60">Click para continuar</div>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 transition group-hover:bg-white/15 group-hover:text-white">
                  <FiArrowRight />
                </div>
              </div>
              <div className="h-[2px] w-full bg-gradient-to-r from-emerald-400/0 via-emerald-400/40 to-emerald-400/0 opacity-60" />
            </button>
          );
        })}
      </div>

      {proyectosFiltrados.length === 0 && (
        <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/50">
          No se encontraron proyectos con ese filtro.
        </p>
      )}

      {isFilterOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl bg-white text-black shadow-xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b px-4 py-4">
              <span className="font-semibold">Filtrar proyectos visibles</span>
            </div>

            <div className="flex flex-col gap-3 p-4">
              <input
                type="text"
                placeholder="Buscar..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="h-11 w-full rounded-xl border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
              />

              <div className="max-h-[52dvh] overflow-y-auto rounded-xl border text-sm">
                <label className="sticky top-0 flex min-h-11 items-center gap-3 border-b bg-gray-100 px-3">
                  <input
                    type="checkbox"
                    checked={proyectos.every((p) => filterSelection[p.nombre] !== false)}
                    onChange={(e) => seleccionarTodo(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span>(Seleccionar todo)</span>
                </label>

                {proyectos
                  .filter((p) => p.nombre.toLowerCase().includes(filterSearch.toLowerCase()))
                  .map((p) => (
                    <label
                      key={p.nombre}
                      className="flex min-h-11 cursor-pointer items-center gap-3 px-3 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={filterSelection[p.nombre] !== false}
                        onChange={() => toggleSeleccionProyecto(p.nombre)}
                        className="h-4 w-4"
                      />
                      <span>{p.nombre}</span>
                    </label>
                  ))}
              </div>
            </div>

            <div className="flex gap-2 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="h-11 flex-1 rounded-xl border border-gray-300 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={aplicarFiltro}
                className="h-11 flex-1 rounded-xl bg-black text-sm font-medium text-white"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
