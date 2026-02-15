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

export default function FormcurePage() {
  const machineId = "formcure";

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
      setMateriales([]);
      setQsURL("");
      setRecursos([]);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agregarMaterial = async () => {
    const v = nuevoMaterial.trim();
    if (!v) return;
    const actualizados = [...materiales, v];
    await updateDoc(refDoc, { materiales: actualizados });
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

  const prettyNameFromUrl = (url: string) =>
    decodeURIComponent(url.split("/").pop()?.split("?")[0] || "archivo")
      .split("%2F")
      .pop();

  const handleUploadRecursos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!isAdmin) return;

    setUploading(true);
    try {
      const nuevos: Recurso[] = [];

      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/\s+/g, " ").trim();
        const path = `maquinas/${machineId}/recursos/${Date.now()}_${safeName}`;
        const fileRef = storageRef(storage, path);

        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);

        nuevos.push({ name: safeName, url, createdAt: Date.now() });
      }

      const actualizados = [...recursos, ...nuevos].sort(
        (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
      );

      await updateDoc(refDoc, { recursos: actualizados });
      await fetchData();
    } catch (e) {
      console.error(e);
      alert("No se pudieron subir los recursos. Revisa consola/permisos de Storage.");
    } finally {
      setUploading(false);
    }
  };

  const eliminarRecurso = async (r: Recurso) => {
    if (!isAdmin) return;

    try {
      const url = r.url;
      const encodedPath = url.split("/o/")[1]?.split("?")[0];
      if (encodedPath) {
        const fullPath = decodeURIComponent(encodedPath);
        const fileRef = storageRef(storage, fullPath);
        await deleteObject(fileRef);
      }

      const actualizados = recursos.filter((x) => x.url !== r.url);
      await updateDoc(refDoc, { recursos: actualizados });
      fetchData();
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar el recurso. Revisa consola/permisos de Storage.");
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

        {/* Layout */}
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-5 gap-10 items-start">
          {/* Card principal */}
          <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl overflow-hidden">
            <div className="p-8">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Form Cure
              </h1>
              <p className="mt-3 text-gray-300">
                Cámara de curado UV + calor para optimizar propiedades mecánicas en piezas SLA.
              </p>

              <div className="mt-8 relative w-full h-64 rounded-xl overflow-hidden border border-white/10">
                <Image src="/formcure.jpg" alt="Form Cure" fill className="object-cover" />
                <div className="absolute inset-0 bg-black/35" />
              </div>

              <div className="mt-8 space-y-4 text-gray-200 leading-relaxed">
                <p>
                  La Form Cure es una cámara de curado diseñada por Formlabs para optimizar las propiedades
                  mecánicas y la estabilidad dimensional de las piezas impresas en resina. Utiliza luz UV de
                  alta intensidad y un sistema de calentamiento controlado que permiten completar el proceso
                  de postcurado de manera uniforme y precisa.
                </p>
                <p>
                  Gracias a su control automático de temperatura y tiempo, garantiza que cada resina alcance
                  su máxima resistencia, rigidez y desempeño funcional, convirtiéndola en una herramienta
                  esencial para obtener piezas finales de calidad profesional en aplicaciones de ingeniería,
                  manufactura y dispositivos médicos.
                </p>
              </div>
            </div>

            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
          </div>

          {/* Columna derecha */}
          <div className="lg:col-span-2 space-y-8">
            {/* Materiales */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-xl p-6">
              <h2 className="text-lg font-semibold">Materiales compatibles</h2>

              <ul className="mt-4 space-y-2">
                {materiales.length === 0 ? (
                  <li className="text-gray-400 text-sm">No hay materiales registrados.</li>
                ) : (
                  materiales.map((mat, index) => (
                    <li key={index} className="flex items-center justify-between gap-3">
                      <span className="text-gray-200 text-sm">{mat}</span>
                      {isAdmin && (
                        <button
                          onClick={() => eliminarMaterial(index)}
                          className="text-red-300 hover:text-red-400 transition"
                          aria-label="Eliminar material"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </li>
                  ))
                )}
              </ul>

              {isAdmin && (
                <div className="mt-5 flex items-center gap-2">
                  <input
                    type="text"
                    value={nuevoMaterial}
                    onChange={(e) => setNuevoMaterial(e.target.value)}
                    placeholder="Agregar material"
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 outline-none focus:border-emerald-400/40"
                  />
                  <button
                    onClick={agregarMaterial}
                    className="shrink-0 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 px-3 py-2 text-sm font-medium transition"
                  >
                    Agregar
                  </button>
                </div>
              )}
            </div>

            {/* Quick Start */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-xl p-6">
              <h2 className="text-lg font-semibold">Quick Start</h2>

              <div className="mt-4">
                {qsURL ? (
                  <a
                    href={qsURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-emerald-300 hover:text-emerald-200 transition text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Ver guía técnica
                  </a>
                ) : (
                  <p className="text-gray-400 text-sm">No hay guía técnica disponible.</p>
                )}
              </div>

              {isAdmin && (
                <div className="mt-5">
                  <input
                    type="text"
                    value={qsURL}
                    onChange={(e) => setQsURL(e.target.value)}
                    placeholder="URL del QS"
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 outline-none focus:border-emerald-400/40"
                  />
                  <button
                    onClick={() => actualizarQS(qsURL)}
                    className="mt-3 w-full rounded-lg bg-emerald-600/90 hover:bg-emerald-600 px-3 py-2 text-sm font-medium transition"
                  >
                    Guardar guía técnica
                  </button>
                </div>
              )}
            </div>

            {/* Recursos */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-xl p-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">Recursos</h2>

                {isAdmin && (
                  <label className="inline-flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200 cursor-pointer transition">
                    <Upload className="w-4 h-4" />
                    <span>{uploading ? "Subiendo..." : "Subir"}</span>
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      onChange={(e) => handleUploadRecursos(e.target.files)}
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>

              <p className="mt-2 text-gray-400 text-sm">
                Archivos útiles para el postcurado (tablas de curado, guías, WIs, etc.).
              </p>

              <div className="mt-5 space-y-3">
                {recursos.length === 0 ? (
                  <div className="text-gray-400 text-sm">No hay recursos cargados todavía.</div>
                ) : (
                  recursos.map((r, idx) => (
                    <div
                      key={r.url + idx}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-emerald-300" />
                        </div>

                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-gray-200 hover:text-white transition truncate"
                          title={r.name || prettyNameFromUrl(r.url)}
                        >
                          {r.name || prettyNameFromUrl(r.url)}
                        </a>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-300 hover:text-emerald-200 transition"
                          aria-label="Descargar"
                          title="Descargar"
                        >
                          <Download className="w-4 h-4" />
                        </a>

                        {isAdmin && (
                          <button
                            onClick={() => eliminarRecurso(r)}
                            className="text-red-300 hover:text-red-400 transition"
                            aria-label="Eliminar recurso"
                            title="Eliminar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {isAdmin && (
                <div className="mt-5 text-xs text-gray-500">
                  Sugerencia: sube tablas de postcurado por resina y guías internas.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
