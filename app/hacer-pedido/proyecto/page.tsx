"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { auth } from "@/src/firebase/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";

type Proyecto = {
  nombre: string;
  imagen: string;
};

const proyectos: Proyecto[] = [
  { nombre: "001.Ocumetics", imagen: "/ocumetics.jpeg" },
  { nombre: "002.Labella", imagen: "/Bioana.jpeg" },
//  { nombre: "003.XSONXS", imagen: "/XSONX.png" },
  { nombre: "004.Solvein", imagen: "/Bioana.jpeg" },
  { nombre: "005.XSONXS Wound Heads", imagen: "/XSONX.png" },
  { nombre: "006.AGMI", imagen: "/Bioana.jpeg" },
  { nombre: "007.LumeNXT", imagen: "/LumeNXT.jpg" },
  { nombre: "008.Panter", imagen: "/Bioana.jpeg" },
 { nombre: "009.Recopad", imagen: "/Bioana.jpeg" },
  { nombre: "010.Juno", imagen: "/Bioana.jpeg" },
  //{ nombre: "012.Neurocap", imagen: "/Bioana.jpeg" },
  { nombre: "013.T-EZ", imagen: "/Bioana.jpeg" },
  { nombre: "014.QIKCap handle", imagen: "/Bioana.jpeg" },
  { nombre: "015.QIKCap disposible", imagen: "/Bioana.jpeg" },
  { nombre: "016.Portacad shield", imagen: "/Bioana.jpeg" },
  { nombre: "017.JNM", imagen: "/Bioana.jpeg" },
  { nombre: "027.XSCRUB", imagen: "/XSCRUB.jpeg" },
  { nombre: "030.MUV", imagen: "/Bioana.jpeg" },
 //{ nombre: "E010.Orthodoxo", imagen: "/Bioana.jpeg" },
  { nombre: "E011.Orthodoxo Anclas", imagen: "/Bioana.jpeg" },
  { nombre: "E012.Falcon View", imagen: "/Bioana.jpeg" },
 // { nombre: "E021.Avarie Menstrual Pads", imagen: "/Bioana.jpeg" },
  { nombre: "E018.Sleep Fascia", imagen: "/Bioana.jpeg" },
  { nombre: "E019.Othotek", imagen: "/Bioana.jpeg" },
  { nombre: "E020.Hero Cap", imagen: "/Bioana.jpeg" },
  { nombre: "E022.Injectable Dermis", imagen: "/Bioana.jpeg" },
  { nombre: "E023.DiViDiaper", imagen: "/Bioana.jpeg" },
 // { nombre: "E006.Structural Heart", imagen: "/Bioana.jpeg" },
 // { nombre: "E024.Leg wrap", imagen: "/Bioana.jpeg" },
  { nombre: "E025.InjectMate", imagen: "/Bioana.jpeg" },
  { nombre: "E026.Birchconcepts", imagen: "/Bioana.jpeg" },
    { nombre: "E028.Peniflx", imagen: "/Bioana.jpeg" },
  { nombre: "E029.Zipstich", imagen: "/Bioana.jpeg" },
   { nombre: "E031.Orthodoxo Cople", imagen: "/Bioana.jpeg" },
  { nombre: "E033.Sport Care", imagen: "/Bioana.jpeg" },
  { nombre: "E034.Sage guard", imagen: "/Bioana.jpeg" },
  { nombre: "Otro", imagen: "/otro.jpg" },
];

export default function ProyectoPage() {
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState("");
  const [hiddenProjects, setHiddenProjects] = useState<string[]>([]);
  const [storageKey, setStorageKey] = useState<string | null>(null);

  // Popup de filtro tipo Excel
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterSelection, setFilterSelection] = useState<Record<string, boolean>>(
    {}
  );

  // Ligar preferencias al usuario (uid) y cargarlas desde localStorage
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const key = user?.uid
        ? `hiddenProjects_${user.uid}`
        : "hiddenProjects_guest";

      setStorageKey(key);

      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(key);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              setHiddenProjects(parsed);
            }
          } catch (error) {
            console.error("Error leyendo hiddenProjects de localStorage", error);
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const seleccionarProyecto = (nombre: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("proyecto", nombre);
    }
    router.push("/hacer-pedido/servicios");
  };

  // Abrir el popup de filtro y preparar la selección temporal
  const abrirFiltro = () => {
    const initial: Record<string, boolean> = {};
    proyectos.forEach((p) => {
      initial[p.nombre] = !hiddenProjects.includes(p.nombre); // true = visible
    });
    setFilterSelection(initial);
    setFilterSearch("");
    setIsFilterOpen(true);
  };

  const toggleSeleccionProyecto = (nombre: string) => {
    setFilterSelection((prev) => ({
      ...prev,
      [nombre]: !prev[nombre],
    }));
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
      .filter((p) => !filterSelection[p.nombre]) // los NO seleccionados se ocultan
      .map((p) => p.nombre);

    setHiddenProjects(nextHidden);

    if (storageKey && typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(nextHidden));
    }

    setIsFilterOpen(false);
  };

  const proyectosFiltrados = proyectos.filter((p) => {
    const visible = !hiddenProjects.includes(p.nombre);
    if (!visible) return false;

    const matchesSearch = p.nombre
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  return (
    <div>
      {/* Botón de regreso */}
      <button
        onClick={() => router.push("/")}
        className="mb-4 bg-white text-black px-4 py-2 rounded flex items-center gap-2 hover:bg-gray-200"
      >
        <FiArrowLeft /> Regresar
      </button>

      <h1 className="text-xl mb-4 font-semibold">Selecciona tu proyecto</h1>

      {/* Controles: buscador + botón de filtro tipo Excel */}
      <div className="mb-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <input
          type="text"
          placeholder="Buscar proyecto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:max-w-md px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          type="button"
          onClick={abrirFiltro}
          className="self-start md:self-auto bg-white text-black px-4 py-2 rounded border border-gray-300 hover:bg-gray-100 text-sm"
        >
          Filtrar proyectos
        </button>
      </div>

      {/* Grid de proyectos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {proyectosFiltrados.map((p) => (
          <div
            key={p.nombre}
            onClick={() => seleccionarProyecto(p.nombre)}
            className="relative rounded-xl overflow-hidden shadow-lg group transition cursor-pointer"
          >
            <img
              src={p.imagen}
              alt={p.nombre}
              className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
            />

            <div className="absolute bottom-3 left-3 right-3 bg-white text-black rounded-full px-4 py-1 flex justify-between items-center">
              <span className="text-sm font-medium">{p.nombre}</span>
              <FiArrowRight />
            </div>
          </div>
        ))}
      </div>

      {proyectosFiltrados.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">
          No se encontraron proyectos con ese filtro.
        </p>
      )}

      {/* Popup de filtro tipo Excel */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40">
          <div className="bg-white text-black rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b flex justify-between items-center">
              <span className="font-semibold text-sm">
                Filtrar proyectos visibles
              </span>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {/* Buscador dentro del popup */}
              <input
                type="text"
                placeholder="Buscar..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />

              {/* Lista con checkboxes */}
              <div className="border rounded max-h-64 overflow-y-auto text-sm">
                {/* Seleccionar todo */}
                <label className="flex items-center gap-2 px-2 py-1 border-b bg-gray-100 sticky top-0">
                  <input
                    type="checkbox"
                    checked={proyectos.every(
                      (p) => filterSelection[p.nombre] !== false
                    )}
                    onChange={(e) => seleccionarTodo(e.target.checked)}
                    className="h-3 w-3"
                  />
                  <span>(Seleccionar todo)</span>
                </label>

                {proyectos
                  .filter((p) =>
                    p.nombre
                      .toLowerCase()
                      .includes(filterSearch.toLowerCase())
                  )
                  .map((p) => (
                    <label
                      key={p.nombre}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filterSelection[p.nombre] !== false}
                        onChange={() => toggleSeleccionProyecto(p.nombre)}
                        className="h-3 w-3"
                      />
                      <span>{p.nombre}</span>
                    </label>
                  ))}
              </div>
            </div>

            <div className="px-4 py-3 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={aplicarFiltro}
                className="px-3 py-1 text-sm rounded bg-black text-white hover:bg-gray-800"
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
