"use client";

import { useEffect, useState } from "react";
import { db } from "@/src/firebase/firebaseConfig";
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { useAuth } from "@/src/Context/AuthContext";
import { FiArrowLeft } from "react-icons/fi";

export default function UltimakerPage() {
  const [materiales, setMateriales] = useState<string[]>([]);
  const [nuevoMaterial, setNuevoMaterial] = useState("");
  const [qsURL, setQsURL] = useState("");
  const { user } = useAuth();
  const esAdmin = user?.email === "jahaziel@bioana.com" || user?.email === "manuel@bioana.com";

  const fetchData = async () => {
  const ref = doc(db, "maquinas", "ultimaker");
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    setMateriales(data.materiales || []);
    setQsURL(data.qs || "");
  } else {
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
      await updateDoc(doc(db, "maquinas", "ultimaker"), { materiales: actualizados });
      setNuevoMaterial("");
      fetchData();
    }
  };

  const eliminarMaterial = async (index: number) => {
    const actualizados = materiales.filter((_, i) => i !== index);
    await updateDoc(doc(db, "maquinas", "ultimaker"), { materiales: actualizados });
    fetchData();
  };

  const actualizarQS = async (nuevaURL: string) => {
    const ref = doc(db, "maquinas", "ultimaker");
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
        <h1 className="text-3xl font-bold mb-6">Ultimaker 2+</h1>

        <img
          src="/Ultimaker.jpg"
          alt="Ultimaker 2+"
          className="w-full h-auto max-w-md rounded mb-6 shadow"
        />

        <p className="mb-6">
  La Ultimaker 2+ es una impresora 3D de alta precisión diseñada para ofrecer resultados consistentes y de calidad profesional. 
  Es una de las máquinas más confiables en el ámbito del prototipado rápido, gracias a su estructura estable, facilidad de uso y excelente calidad de impresión.
</p>

<p className="mb-6">
  Cuenta con un volumen de impresión de 223 x 223 x 205 mm y utiliza filamento de 2.85 mm de diámetro. 
  Dispone de boquillas intercambiables de 0.25 mm, 0.4 mm, 0.6 mm y 0.8 mm, lo que permite adaptarse a distintos niveles de detalle y velocidad. 
  Su resolución de capa alcanza las 20 micras, y su velocidad de impresión varía entre 30 y 300 mm/s.
</p>

<p className="mb-6">
  La temperatura máxima del hotend es de 260 °C y la de la cama calefactada es de 100 °C, lo que ayuda a minimizar deformaciones durante la impresión. 
  Es compatible con materiales como PLA, ABS, CPE, Nylon, TPU y otros filamentos de 2.85 mm, lo que la hace versátil para distintos proyectos.
</p>

<p className="mb-6">
  Entre sus ventajas destacan su alta confiabilidad, excelente calidad superficial, versatilidad en materiales y boquillas, así como su fácil calibración y mantenimiento, 
  lo que la convierte en una opción ideal para entornos de laboratorio, diseño e ingeniería.
</p>


        <h2 className="text-xl font-semibold mb-2">Materiales disponibles:</h2>
        <ul className="list-disc list-inside space-y-1 mb-4">
          {materiales.map((mat, index) => (
            <li key={index} className="flex justify-between items-center">
              {mat}
              {esAdmin && (
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

        {esAdmin && (
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

        {esAdmin && (
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

