"use client";

import { useRouter } from "next/navigation";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";

const proyectos = [
  { nombre: "001.Ocumetics", imagen: "/ocumetics.jpeg" },
  { nombre: "002.Labella", imagen: "/Bioana.jpeg" },
  { nombre: "003.XSONXS", imagen: "/XSONX.png" },
  { nombre: "004.Solvein", imagen: "/Bioana.jpeg" },
  { nombre: "005.XSONXS wound heads", imagen: "/XSONX.png" },
  { nombre: "006.AGMI", imagen: "/Bioana.jpeg" },
  { nombre: "007.LumeNXT", imagen: "/LumeNXT.jpg" },
  { nombre: "008.Panter", imagen: "/Bioana.jpeg" },
  { nombre: "009.Recopad", imagen: "/Bioana.jpeg" },
  { nombre: "010.Juno", imagen: "/Bioana.jpeg" },
  { nombre: "012.Neurocap", imagen: "/Bioana.jpeg" },
  { nombre: "013.T-EZ", imagen: "/Bioana.jpeg" },
  { nombre: "014.QIK Cap handle", imagen: "/Bioana.jpeg" },
  { nombre: "015.QIK Cap disponible", imagen: "/Bioana.jpeg" },
  { nombre: "016.Portacad shield", imagen: "/Bioana.jpeg" },
  { nombre: "027.XSCRUB", imagen: "/XSCRUB.jpeg" },
  { nombre: "029.Zipstich", imagen: "/Bioana.jpeg" },
  { nombre: "030.MUV", imagen: "/Bioana.jpeg" },
  { nombre: "E001.Avarie Menstrual Pads", imagen: "/Bioana.jpeg" },
  { nombre: "E002.Hero Cap", imagen: "/Bioana.jpeg" },
  { nombre: "E003.Injectable Dermis", imagen: "/Bioana.jpeg" },
  { nombre: "E004.DiViDiaper", imagen: "/Bioana.jpeg" },
  { nombre: "E006.Structural Heart", imagen: "/Bioana.jpeg" },
  { nombre: "E007.Leg wrap", imagen: "/Bioana.jpeg" },
  { nombre: "E009.InjectMate", imagen: "/Bioana.jpeg" },
  { nombre: "E010.Orthodoxo", imagen: "/Bioana.jpeg" },
  { nombre: "E011.Orthodoxo Anclas", imagen: "/Bioana.jpeg" },
  { nombre: "E012.Falcon View", imagen: "/Bioana.jpeg" },
  { nombre: "E013.Birchconcepts", imagen: "/Bioana.jpeg" },
  { nombre: "E015.Sport Care", imagen: "/Bioana.jpeg" },
  { nombre: "Otro", imagen: "/otro.jpg" }, 
];

export default function ProyectoPage() {
  const router = useRouter();

  const seleccionarProyecto = (nombre: string) => {
    // Puedes guardar en localStorage o en un contexto el proyecto seleccionado
    localStorage.setItem("proyecto", nombre);
    router.push("/hacer-pedido/servicios");
  };

  return (
    <div>
      {/* Botón de regreso */}
      <button
        onClick={() => router.push("/")}
        className="mb-4 bg-white text-black px-4 py-2 rounded flex items-center gap-2 hover:bg-gray-200"
      >
        <FiArrowLeft /> Regresar
      </button>

      <h1 className="text-xl mb-6 font-semibold">Selecciona tu proyecto</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {proyectos.map((p) => (
          <button
            key={p.nombre}
            onClick={() => seleccionarProyecto(p.nombre)}
            className="relative rounded-xl overflow-hidden shadow-lg group"
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
          </button>
        ))}
      </div>
    </div>
  );
}
