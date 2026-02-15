"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { db, storage } from "@/src/firebase/firebaseConfig";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { useAuth } from "@/src/Context/AuthContext";
import { ArrowLeft, Download, Upload, FileText, X } from "lucide-react";

type Recurso = {
  name: string;
  url: string;
  createdAt?: number;
};

export default function Formlabs2Page() {
  const machineId = "formlabs2";

  const [materiales, setMateriales] = useState<string[]>([]);
  const [nuevoMaterial, setNuevoMaterial] = useState("");
  const [qsURL, setQsURL] = useState("");

  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [uploading, setUploading] = useState(false);

  const { isAdmin } = useAuth();

  const refDoc = useMemo(() => doc(db, "maquinas", machineId), [machineId]);

  const fetchData = async () => {
    const snap = await getDoc(refDoc);

    if (snap.exists()) {
      const data = snap.data() as any;
      setMateriales(data.materiales || []);
      setQsURL(data.qs || "");
      setRecursos(Array.isArray(data.recursos) ? data.recursos : []);
    } else {
      await setDoc(refDoc, {
        materiales: [],
        qs: "",
        recursos: [],
      });
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const agregarMaterial = async () => {
    const v = nuevoMaterial.trim();
    if (!v) return;
    await updateDoc(refDoc, { materiales: [...materiales, v] });
    setNuevoMaterial("");
    fetchData();
  };

  const eliminarMaterial = async (index: number) => {
    const actualizados = materiales.filter((_, i) => i !== index);
    await updateDoc(refDoc, { materiales: actualizados });
    fetchData();
  };

  const actualizarQS = async (nuevaURL: string) => {
    await updateDoc(refDoc, { qs: nuevaURL });
    fetchData();
  };

  const handleUploadRecursos = async (files: FileList | null) => {
    if (!files || !isAdmin) return;

    setUploading(true);
    try {
      const nuevos: Recurso[] = [];

      for (const file of Array.from(files)) {
        const path = `maquinas/${machineId}/recursos/${Date.now()}_${file.name}`;
        const fileRef = storageRef(storage, path);

        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);

        nuevos.push({ name: file.name, url, createdAt: Date.now() });
      }

      await updateDoc(refDoc, {
        recursos: [...recursos, ...nuevos].sort(
          (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
        ),
      });

      fetchData();
    } catch (e) {
      console.error(e);
      alert("Error subiendo archivos.");
    } finally {
      setUploading(false);
    }
  };

  const eliminarRecurso = async (r: Recurso) => {
    if (!isAdmin) return;

    try {
      const encodedPath = r.url.split("/o/")[1]?.split("?")[0];
      if (encodedPath) {
        const fullPath = decodeURIComponent(encodedPath);
        const fileRef = storageRef(storage, fullPath);
        await deleteObject(fileRef);
      }

      await updateDoc(refDoc, {
        recursos: recursos.filter((x) => x.url !== r.url),
      });

      fetchData();
    } catch (e) {
      console.error(e);
      alert("Error eliminando archivo.");
    }
  };

  return (
    <div className="min-h-screen px-6 py-24 text-white">
      <div className="max-w-6xl mx-auto">
        {/* Back */}
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-sm text-gray-300 hover:text-emerald-400 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Regresar
        </button>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Main Info */}
          <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl overflow-hidden">
            <div className="p-8">
              <h1 className="text-3xl md:text-4xl font-bold">
                Formlabs 2B
              </h1>

              <div className="mt-8 relative w-full h-64 rounded-xl overflow-hidden border border-white/10">
                <Image
                  src="/formlabs2B.jpeg"
                  alt="Formlabs 2B"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/35" />
              </div>

              <div className="mt-8 space-y-4 text-gray-200 leading-relaxed">
                <p>
                  Impresora SLA de alta precisión que utiliza resina líquida fotosensible
                  solidificada capa por capa mediante láser.
                </p>
                <p>
                  Volumen de impresión: 145 x 145 x 175 mm, resolución hasta 25 micras.
                </p>
                <p>
                  Compatible con resinas estándar, ingeniería, biocompatibles y dentales.
                </p>
                <p>
                  Ideal para prototipos funcionales, modelos detallados y aplicaciones médicas.
                </p>
              </div>
            </div>

            <div className="h-[2px] bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
          </div>

          {/* Side Panel */}
          <div className="lg:col-span-2 space-y-8">
            {/* Materiales */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6">
              <h2 className="text-lg font-semibold">Materiales compatibles</h2>

              <ul className="mt-4 space-y-2">
                {materiales.map((mat, index) => (
                  <li key={index} className="flex justify-between items-center">
                    {mat}
                    {isAdmin && (
                      <button
                        onClick={() => eliminarMaterial(index)}
                        className="text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {isAdmin && (
                <div className="mt-4 flex gap-2">
                  <input
                    type="text"
                    value={nuevoMaterial}
                    onChange={(e) => setNuevoMaterial(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 px-3 py-2 rounded"
                  />
                  <button
                    onClick={agregarMaterial}
                    className="bg-emerald-600 px-3 py-2 rounded"
                  >
                    Agregar
                  </button>
                </div>
              )}
            </div>

            {/* Quick Start */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6">
              <h2 className="text-lg font-semibold">Quick Start</h2>

              {qsURL ? (
                <a
                  href={qsURL}
                  target="_blank"
                  className="text-emerald-300 flex items-center gap-2 mt-3"
                >
                  <Download className="w-4 h-4" />
                  Ver guía técnica
                </a>
              ) : (
                <p className="text-gray-400 mt-3">
                  No hay guía técnica disponible.
                </p>
              )}

              {isAdmin && (
                <div className="mt-4">
                  <input
                    type="text"
                    value={qsURL}
                    onChange={(e) => setQsURL(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 px-3 py-2 rounded"
                  />
                  <button
                    onClick={() => actualizarQS(qsURL)}
                    className="mt-3 bg-emerald-600 w-full px-3 py-2 rounded"
                  >
                    Guardar guía técnica
                  </button>
                </div>
              )}
            </div>

            {/* Recursos */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Recursos</h2>
                {isAdmin && (
                  <label className="cursor-pointer text-emerald-300 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Subir
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => handleUploadRecursos(e.target.files)}
                    />
                  </label>
                )}
              </div>

              <div className="mt-4 space-y-3">
                {recursos.map((r) => (
                  <div
                    key={r.url}
                    className="flex justify-between items-center bg-black/20 border border-white/10 rounded px-3 py-2"
                  >
                    <a
                      href={r.url}
                      target="_blank"
                      className="flex items-center gap-2 text-sm text-gray-200"
                    >
                      <FileText className="w-4 h-4 text-emerald-300" />
                      {r.name}
                    </a>

                    {isAdmin && (
                      <button
                        onClick={() => eliminarRecurso(r)}
                        className="text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


