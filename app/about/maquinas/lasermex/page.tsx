"use client";

import { useEffect, useState } from "react";
import { db } from "@/src/firebase/firebaseConfig";
import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { useAuth } from "@/src/Context/AuthContext";
import { FiArrowLeft } from "react-icons/fi";

export default function LasermexPage() {
  const [materiales, setMateriales] = useState<string[]>([]);
  const [nuevoMaterial, setNuevoMaterial] = useState("");
  const [qsURL, setQsURL] = useState("");
  const { user } = useAuth();
  const esAdmin = user?.email === "jahaziel@bioana.com" || user?.email === "manuel@bioana.com";

  // Función reutilizable para cargar datos desde Firestore
const fetchData = async () => {
  const ref = doc(db, "maquinas", "lasermex");
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    setMateriales(data.materiales || []);
    setQsURL(data.qs || "");
  }
};

useEffect(() => {
  fetchData();
}, []);

const agregarMaterial = async () => {
  if (nuevoMaterial.trim() !== "") {
    const actualizados = [...materiales, nuevoMaterial.trim()];
    await updateDoc(doc(db, "maquinas", "lasermex"), { materiales: actualizados });
    setNuevoMaterial("");
    fetchData(); // Recargar desde Firestore
  }
};

const eliminarMaterial = async (index: number) => {
  const actualizados = materiales.filter((_, i) => i !== index);
  await updateDoc(doc(db, "maquinas", "lasermex"), { materiales: actualizados });
  fetchData(); // Recargar desde Firestore
};

const actualizarQS = async (nuevaURL: string) => {
  const ref = doc(db, "maquinas", "lasermex");
  await updateDoc(ref, { qs: nuevaURL });
  fetchData(); // Recargar desde Firestore
};

  return (
    <div className="min-h-screen bg-white text-gray-900 px-6 py-20">
      {/* Botón de regreso */}
      <div className="max-w-6xl mx-auto mb-6">
        <button
          onClick={() => window.history.back()}
          className="mb-4 bg-black text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-black-200"
        >
          <FiArrowLeft /> Regresar
        </button>
      </div>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Lasermex</h1>

        <img
          src="/lasermex.png"
          alt="Lasermex"
          className="w-full h-auto max-w-md rounded mb-6 shadow"
        />

        <p className="mb-6">
          La Lasermex es una cortadora láser de alta precisión, ideal para cortar y grabar materiales como acrílico, madera y MDF.
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

