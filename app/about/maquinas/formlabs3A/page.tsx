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

export default function Formlabs3APage() {
  const [materiales, setMateriales] = useState<string[]>([]);
  const [nuevoMaterial, setNuevoMaterial] = useState("");
  const [qsURL, setQsURL] = useState("");
  const { user } = useAuth();
  const esAdmin = user?.email === "jahaziel@bioana.com" || user?.email === "manuel@bioana.com";

  const fetchData = async () => {
  const ref = doc(db, "maquinas", "formlabs3A");
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
      await updateDoc(doc(db, "maquinas", "formlabs3A"), { materiales: actualizados });
      setNuevoMaterial("");
      fetchData();
    }
  };

  const eliminarMaterial = async (index: number) => {
    const actualizados = materiales.filter((_, i) => i !== index);
    await updateDoc(doc(db, "maquinas", "formlabs3A"), { materiales: actualizados });
    fetchData();
  };

  const actualizarQS = async (nuevaURL: string) => {
    const ref = doc(db, "maquinas", "formlabs3A");
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
        <h1 className="text-3xl font-bold mb-6">Formlabs 3B</h1>

        <img
          src="/formlabs3B.jpg"
          alt="Formlabs 3B"
          className="w-full h-auto max-w-md rounded mb-6 shadow"
        />

       <p className="mb-6">
  La Formlabs Form 3B es una impresora 3D de tecnología LFS (Low Force Stereolithography) optimizada para aplicaciones profesionales y médicas. 
  Utiliza resina líquida fotosensible que se cura capa por capa con un sistema láser avanzado, ofreciendo piezas con alta precisión y acabados extremadamente finos.
</p>

<p className="mb-6">
  Su volumen de impresión es de 145 x 145 x 185 mm, con una resolución de capa mínima de 25 micras. 
  Gracias a su sistema de tanque flexible y óptica de alta calidad, reduce las fuerzas de desprendimiento durante la impresión, prolongando la vida útil de los consumibles y mejorando la calidad de las piezas.
</p>

<p className="mb-6">
  Es compatible con una amplia gama de resinas, incluyendo opciones biocompatibles y de grado médico, lo que la hace ideal para odontología, ortopedia, fabricación de dispositivos médicos y prototipado de precisión. 
  Su software PreForm facilita la preparación de archivos y optimiza la orientación y soportes para cada impresión.
</p>

<p className="mb-6">
  Entre sus ventajas destacan la calidad de superficie superior, alta repetibilidad en piezas complejas, conectividad por Wi-Fi, Ethernet y USB, así como un flujo de trabajo optimizado para uso intensivo en entornos profesionales y de laboratorio.
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
