"use client";

import { useState, useRef } from "react";
import { ref, uploadBytes } from "firebase/storage";
import { storage } from "@/src/firebase/firebaseConfig";
import { FiX, FiUpload } from "react-icons/fi";

export default function FixtureUploadPage() {
  const [archivos, setArchivos] = useState<File[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevosArchivos = Array.from(e.target.files || []);
    setArchivos((prev) => [...prev, ...nuevosArchivos]);
    e.target.value = ""; // limpia el input para permitir volver a elegir el mismo archivo
  };

  const handleRemove = (nombre: string) => {
    setArchivos((prev) => prev.filter((file) => file.name !== nombre));
  };

  const handleClickBoton = () => {
    fileInputRef.current?.click();
  };

  const handleUploadAll = async () => {
  if (archivos.length === 0) return alert("Selecciona al menos un archivo.");
  setSubiendo(true);

  try {
    for (const archivo of archivos) {
      console.log("⏫ Subiendo archivo:", archivo.name);

      const storageRef = ref(storage, `fixture-tests/${archivo.name}`);

      const uploadWithTimeout = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`⏱️ Timeout al subir ${archivo.name}`));
        }, 10000); // 10 segundos de límite por archivo

        uploadBytes(storageRef, archivo)
          .then(() => {
            clearTimeout(timeout);
            console.log("✅ Subido:", archivo.name);
            resolve();
          })
          .catch((error) => {
            clearTimeout(timeout);
            console.error("❌ Error al subir:", archivo.name, error);
            reject(error);
          });
      });

      await uploadWithTimeout;
    }

    alert("✅ Todos los archivos fueron subidos.");
    setArchivos([]);
  } catch (err: any) {
    console.error("❌ Falló la subida:", err);
    alert(`Error: ${err.message || err}`);
  }

  setSubiendo(false);
};



  return (
    <div className="p-6 space-y-4 max-w-xl mx-auto bg-white rounded-xl shadow">
      <h1 className="text-xl font-bold text-black">Subir archivos de prueba</h1>

      {/* Input oculto */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleSelectFiles}
        className="hidden"
      />

      {/* Botón personalizado */}
      <button
        onClick={handleClickBoton}
        className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 flex items-center gap-2"
      >
        <FiUpload /> Seleccionar archivos
      </button>

      {/* Lista de archivos */}
      {archivos.length > 0 && (
        <ul className="text-black space-y-2">
          {archivos.map((file) => (
            <li key={file.name} className="flex justify-between items-center bg-gray-100 px-3 py-2 rounded">
              <span className="truncate">{file.name}</span>
              <button
                onClick={() => handleRemove(file.name)}
                className="text-red-600 hover:text-red-800"
              >
                <FiX />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Botón de subir */}
      <button
        onClick={handleUploadAll}
        disabled={subiendo || archivos.length === 0}
        className="w-full bg-green-600 text-white py-3 rounded hover:bg-green-700 transition"
      >
        {subiendo ? "Subiendo..." : "Subir archivos"}
      </button>
    </div>
  );
}
