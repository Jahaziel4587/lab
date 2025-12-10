"use client";

import { useEffect, useState } from "react";
import { db } from "@/src/firebase/firebaseConfig";
import { doc, getDoc, updateDoc, setDoc} from "firebase/firestore";
import { useAuth } from "@/src/Context/AuthContext";
import { FiArrowLeft } from "react-icons/fi";

  export default function avidcncPage() {
    const [materiales, setMateriales] = useState<string[]>([]);
    const [nuevoMaterial, setNuevoMaterial] = useState("");
    const [qsURL, setQsURL] = useState("");
    const { user } = useAuth();
    const {isAdmin} = useAuth();
    const fetchData = async () => {
    const ref = doc(db, "maquinas", "avidcnc");
    const snap = await getDoc(ref);

          if (snap.exists()) {
          const data = snap.data();
          setMateriales(data.materiales || []);
          setQsURL(data.qs || "");
          } 
          else {
            // Creamos el documento con campos vacíos
            await setDoc(ref, {
              materiales: [],
              qs: ""
            });
            setMateriales([]);
            setQsURL("");
        }
        };

  useEffect(() => {
    fetchData();
  }, []);

  const agregarMaterial = async () => {
    if (nuevoMaterial.trim() !== "") {
      const actualizados = [...materiales, nuevoMaterial.trim()];
      await updateDoc(doc(db, "maquinas", "avidcnc"), { materiales: actualizados });
      setNuevoMaterial("");
      fetchData();
    }
  };

  const eliminarMaterial = async (index: number) => {
    const actualizados = materiales.filter((_, i) => i !== index);
    await updateDoc(doc(db, "maquinas", "avidcnc"), { materiales: actualizados });
    fetchData();
  };

  const actualizarQS = async (nuevaURL: string) => {
    const ref = doc(db, "maquinas", "avidcnc");
    await updateDoc(ref, { qs: nuevaURL });
    fetchData();
  };

  return (
     <div className="bg-black text-white p-8 rounded-lg max-w-4xl mx-auto">
      <div className="max-w-6xl mx-auto mb-6">
        <button
          onClick={() => window.history.back()}
          className="mb-4 bg-white text-black px-4 py-2 rounded flex items-center gap-2 hover:bg-black-200"
        >
          <FiArrowLeft /> Regresar
        </button>
      </div>

      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Avid CNC Benchtop PRO</h1>

        <img
          src="/cnc.jpg"
          alt="avidcnc"
          className="w-full h-auto max-w-md rounded mb-6 shadow"
        />

       <p className="mb-6">
  La Avid CNC Benchtop PRO 24x24 es una fresadora CNC de escritorio diseñada para ofrecer precisión industrial en un formato compacto. 
  Es ideal para trabajos de mecanizado de alta calidad en madera, plásticos y metales no ferrosos, siendo una excelente opción para laboratorios de prototipado, talleres y entornos educativos.
</p>

<p className="mb-6">
  Cuenta con un área de trabajo de 610 x 610 mm (24" x 24") y una estructura robusta de aluminio y acero que garantiza estabilidad y precisión durante el corte. 
  Su sistema de movimiento utiliza guías lineales y husillos de bolas, lo que permite lograr tolerancias ajustadas incluso en piezas complejas.
</p>

<p className="mb-6">
  Es compatible con diversos materiales, incluyendo maderas duras y blandas, MDF, acrílico, plásticos técnicos y aluminio. 
  Permite el uso de fresas de diferentes diámetros y configuraciones, y se controla mediante software de CNC como Mach4 o similares, con conectividad por puerto USB o Ethernet según el controlador instalado.
</p>

<p className="mb-6">
  Entre sus ventajas destacan la precisión de corte, la capacidad de producir piezas personalizadas con alta repetibilidad, su formato compacto que se adapta a espacios reducidos y la versatilidad para realizar tanto cortes como grabados y mecanizados 3D.
</p>


        <h2 className="text-xl font-semibold mb-2">Materiales disponibles:</h2>
        <ul className="list-disc list-inside space-y-1 mb-4">
          {materiales.map((mat, index) => (
            <li key={index} className="flex justify-between items-center">
              {mat}
              {isAdmin && (
                <button
                  onClick={() => eliminarMaterial(index)}
                  className="text-red-600 ml-2 hover:text-red-800"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>

        {isAdmin && (
          <div className="flex items-center gap-2 mb-6">
            <input
              type="text"
              value={nuevoMaterial}
              onChange={(e) => setNuevoMaterial(e.target.value)}
              placeholder="Agregar material"
              className="border px-2 py-1 rounded"
            />
            <button
              onClick={agregarMaterial}
              className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
            >
              Agregar
            </button>
          </div>
        )}

        <h2 className="text-xl font-semibold mb-2">Quick Start:</h2>
        {qsURL ? (
          <a
            href={qsURL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            Ver guía técnica
          </a>
        ) : (
          <p>No hay guía técnica disponible.</p>
        )}

        {isAdmin && (
          <div className="mt-4">
            <input
              type="text"
              value={qsURL}
              onChange={(e) => setQsURL(e.target.value)}
              placeholder="URL del QS"
              className="border px-2 py-1 rounded w-full"
            />
            <button
              onClick={() => actualizarQS(qsURL)}
              className="mt-2 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
            >
              Guardar guía técnica
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

