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

export default function formwashPage() {
  const [materiales, setMateriales] = useState<string[]>([]);
  const [nuevoMaterial, setNuevoMaterial] = useState("");
  const [qsURL, setQsURL] = useState("");
  const { user } = useAuth();
 // const esAdmin = user?.email === "jahaziel@bioana.com" || user?.email === "manuel@bioana.com";
const {isAdmin} = useAuth();
  const fetchData = async () => {
  const ref = doc(db, "maquinas", "formwash");
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
      await updateDoc(doc(db, "maquinas", "forwash"), { materiales: actualizados });
      setNuevoMaterial("");
      fetchData();
    }
  };

  const eliminarMaterial = async (index: number) => {
    const actualizados = materiales.filter((_, i) => i !== index);
    await updateDoc(doc(db, "maquinas", "formwash"), { materiales: actualizados });
    fetchData();
  };

  const actualizarQS = async (nuevaURL: string) => {
    const ref = doc(db, "maquinas", "formwash");
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
        <h1 className="text-3xl font-bold mb-6">Form Wash</h1>

        <img
          src="/formwash.jpg"
          alt="Formwash"
          className="w-full h-auto max-w-md rounded mb-6 shadow"
        />

        <p className="mb-6">
  La Form Wash es un sistema automatizado de lavado diseñado por Formlabs para limpiar piezas impresas en resina de manera eficiente y consistente. 
  Utiliza agitación controlada con IPA u otros solventes compatibles para remover el exceso de resina no curada, asegurando superficies limpias y uniformes sin intervención manual. 
  Su ciclo automatizado, temporizador integrado y opción de lavado directo con la plataforma de impresión reducen errores, mejoran la repetibilidad del proceso y 
  preparan las piezas para un curado final óptimo. Es una herramienta esencial para lograr un flujo de trabajo seguro, limpio y estandarizado en impresión 3D de resina.
</p>

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
