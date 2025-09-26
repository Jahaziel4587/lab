"use client";

import { useRouter } from "next/navigation";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";

const proyectos = [
  { nombre: "001.Ocumetics", imagen: "/ocumetics.jpeg" },
  { nombre: "002.Labella", imagen: "/labella.jpg" },
  { nombre: "003.XSONXS", imagen: "/XSONX.png" },
  { nombre: "004.Solvein", imagen: "/Solvein.jpg" },
  { nombre: "005.XSONXS wound heads", imagen: "/XSONX.png" },
  { nombre: "006.AGMI", imagen: "/AGMI.jpeg" },
  { nombre: "007.LumeNXT", imagen: "/LumeNTX.jpg" },
  { nombre: "008.Panter", imagen: "/Panter.jpeg" },
  { nombre: "009.Recopad", imagen: "/Recopad.jpg" },
  { nombre: "010.Juno", imagen: "/" },
  { nombre: "012.Neurocap", imagen: "/" },
  { nombre: "013.T-EZ", imagen: "/" },
  { nombre: "014.QIK Cap handle", imagen: "/" },
  { nombre: "015.QIK Cap disponible", imagen: "/" },
  { nombre: "016.Portacad shield", imagen: "/" },
  { nombre: "027.XSCRUB", imagen: "/XSCRUB.jpeg" },
  { nombre: "029.Zipstich", imagen: "/" },
  { nombre: "030.MUV", imagen: "/MUV.jpg" },
  { nombre: "E001.Avarie Menstrual Pads", imagen: "/" },
  { nombre: "E002.Hero Cap", imagen: "/" },
  { nombre: "E003.Injectable Dermis", imagen: "/Injectable_dermis.jpg" },
  { nombre: "E004.DiViDiaper", imagen: "/" },
  { nombre: "E006.Structural Heart", imagen: "/" },
  { nombre: "E007.Leg wrap", imagen: "/" },
  { nombre: "E009.InjectMate", imagen: "/" },
  { nombre: "E010.Orthodoxo", imagen: "/" },
  { nombre: "E011.Orthodoxo Anclas", imagen: "/" },
  { nombre: "E012.Falcon View", imagen: "/" },
  { nombre: "E013.Birchconcepts", imagen: "/" },
  { nombre: "E015.Sport Care", imagen: "/SportCare.jpeg" },
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
