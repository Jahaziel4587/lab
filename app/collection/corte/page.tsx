"use client";
import { useEffect, useState } from "react";
import { getDownloadURL, ref, uploadBytes, deleteObject } from "firebase/storage";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db, storage } from "@/src/firebase/firebaseConfig";
import { useAuth } from "@/src/Context/AuthContext";
import { v4 as uuidv4 } from "uuid";

export default function CorteCollectionPage() {
  const [proyectos, setProyectos] = useState<{ imagenURL: string; descripcion: string }[]>([]);
  const [descripcion, setDescripcion] = useState("");
  const [imagen, setImagen] = useState<File | null>(null);

  const { user, isAdmin } = useAuth();

  // 🔁 Cargar proyectos desde Firestore
  const fetchProyectos = async () => {
    const ref = doc(db, "collection", "corte");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      setProyectos(snap.data().proyectos || []);
    } else {
      await setDoc(ref, { proyectos: [] }); // Crea documento vacío si no existe
      setProyectos([]);
    }
  };

  useEffect(() => {
    fetchProyectos();
  }, []);

  // 🟢 Subir nuevo proyecto
  const handleAgregar = async () => {
    if (!imagen || descripcion.trim() === "") {
      alert("Completa todos los campos");
      return;
    }

    const id = uuidv4();
    const storageRef = ref(storage, `collection/corte/${id}`);
    await uploadBytes(storageRef, imagen);
    const imagenURL = await getDownloadURL(storageRef);

    const nuevoProyecto = { imagenURL, descripcion };
    const nuevos = [...proyectos, nuevoProyecto];

    await updateDoc(doc(db, "collection", "corte"), { proyectos: nuevos });

    setDescripcion("");
    setImagen(null);
    fetchProyectos();
  };

  // 🔴 Eliminar tarjeta
  const handleEliminar = async (index: number) => {
    const proyecto = proyectos[index];
    const nuevos = proyectos.filter((_, i) => i !== index);

    // Extraer referencia desde URL
    const match = decodeURIComponent(proyecto.imagenURL).match(/\/o\/(.*?)\?alt/);
    const path = match?.[1].replace(/%2F/g, "/");

    if (path) {
      const imageRef = ref(storage, path);
      await deleteObject(imageRef).catch((err) => console.warn("Error al eliminar imagen:", err));
    }

    await updateDoc(doc(db, "collection", "corte"), { proyectos: nuevos });
    fetchProyectos();
  };

  return (
    <div className="min-h-screen  text-white-900 px-6 py-20">
      <h1 className="text-3xl font-bold text-center mb-10">Proyectos de Corte</h1>
<div className="max-w-6xl mx-auto mb-6">
  <button
    onClick={() => window.history.back()}
    className="mb-4 bg-black text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-gray-800"
  >
    ← Regresar
  </button>
</div>

      {/* 🖼️ Tarjetas mostradas para todos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-16">
        {proyectos.map((p, i) => (
          <div
            key={i}
            className="bg-white text-black rounded-xl shadow overflow-hidden transform hover:scale-105 transition"
          >
            <img
              src={p.imagenURL}
              alt="Proyecto"
              className="w-full h-56 object-cover"
            />
            <div className="p-4">
              <p className="text-sm text-gray-700">{p.descripcion}</p>
              {isAdmin && (
                <button
                  onClick={() => handleEliminar(i)}
                  className="mt-2 text-red-600 text-sm hover:underline"
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 🛠️ Formulario visible solo para admins */}
      {isAdmin && (
        <div className="max-w-xl mx-auto bg-white text-black rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">Agregar nuevo proyecto</h2>

          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImagen(e.target.files?.[0] || null)}
            className="mb-3"
          />
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción del proyecto"
            className="w-full border px-3 py-2 rounded mb-4"
          />
          <button
            onClick={handleAgregar}
            className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
          >
            Subir
          </button>
        </div>
      )}
    </div>
  );
}
