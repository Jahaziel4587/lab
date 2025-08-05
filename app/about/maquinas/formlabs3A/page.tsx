"use client";

import { useEffect, useState } from "react";
import { db } from "@/src/firebase/firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/src/Context/AuthContext";
import { adminEmails } from "@/src/config/admins";

export default function formlabsaPage() {
  const [materiales, setMateriales] = useState<string[]>([]);
  const [nuevoMaterial, setNuevoMaterial] = useState("");
  const [qsURL, setQsURL] = useState("");
  const [editando, setEditando] = useState(false);
  const { user } = useAuth();

  const esAdmin = user?.email && adminEmails.includes(user.email);

  useEffect(() => {
    const fetchData = async () => {
      const docRef = doc(db, "maquinas", "formlabs3a");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMateriales(data.materiales || []);
        setQsURL(data.qsURL || "");
      }
    };
    fetchData();
  }, []);

  const guardarCambios = async () => {
    const docRef = doc(db, "maquinas", "formlabs3a");
    await updateDoc(docRef, {
      materiales,
      qsURL,
    });
    setEditando(false);
  };

  const eliminarMaterial = (index: number) => {
    setMateriales((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 px-6 py-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Formlabs 3A</h1>

        <img
          src="/formlabs3B.jpeg"
          alt="Formlabs 3A"
          className="w-full max-w-md mb-6 rounded shadow"
        />

        <p className="mb-6">
          La Formlabs 3A es una impresora 3D de resina de alta precisión, ideal para fabricar piezas detalladas, prototipos funcionales y componentes médicos de alta resolución.
        </p>

        <h2 className="text-xl font-semibold mb-2">Materiales disponibles:</h2>

        {editando && esAdmin ? (
          <div className="space-y-2">
            {materiales.map((mat, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span>{mat}</span>
                <button
                  onClick={() => eliminarMaterial(idx)}
                  className="text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            ))}
            <input
              type="text"
              placeholder="Nuevo material"
              value={nuevoMaterial}
              onChange={(e) => setNuevoMaterial(e.target.value)}
              className="border px-2 py-1 rounded text-black"
            />
            <button
              onClick={() => {
                if (nuevoMaterial.trim() !== "") {
                  setMateriales([...materiales, nuevoMaterial]);
                  setNuevoMaterial("");
                }
              }}
              className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
            >
              Agregar
            </button>
          </div>
        ) : (
          <ul className="list-disc list-inside space-y-1 mb-4">
            {materiales.map((mat, idx) => (
              <li key={idx}>{mat}</li>
            ))}
          </ul>
        )}

        <h2 className="text-xl font-semibold mt-6 mb-2">Guía técnica:</h2>
        {editando && esAdmin ? (
          <input
            type="text"
            value={qsURL}
            onChange={(e) => setQsURL(e.target.value)}
            className="border px-2 py-1 rounded w-full text-black"
            placeholder="https://..."
          />
        ) : qsURL ? (
          <a
            href={qsURL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            Ver Quick Start
          </a>
        ) : (
          <p>No se ha cargado una guía técnica aún.</p>
        )}

        {esAdmin && (
          <div className="mt-6">
            {editando ? (
              <div className="flex gap-4">
                <button
                  onClick={guardarCambios}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setEditando(false)}
                  className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditando(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Editar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}