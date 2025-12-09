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

export default function LasermexPage() {
  const [materiales, setMateriales] = useState<string[]>([]);
  const [nuevoMaterial, setNuevoMaterial] = useState("");
  const [qsURL, setQsURL] = useState("");
  const { user, isAdmin } = useAuth();
  // const esAdmin = user?.email === "jahaziel@bioana.com" || user?.email === "manuel@bioana.com";

  // Función reutilizable para cargar datos desde Firestore
  const fetchData = async () => {
    const ref = doc(db, "maquinas", "lasermex");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      setMateriales(data.materiales || []);
      setQsURL(data.qs || "");
    } else {
      // Creamos el documento con campos vacíos
      await setDoc(ref, {
        materiales: [],
        qs: "",
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
      await updateDoc(doc(db, "maquinas", "lasermex"), {
        materiales: actualizados,
      });
      setNuevoMaterial("");
      fetchData(); // Recargar desde Firestore
    }
  };

  const eliminarMaterial = async (index: number) => {
    const actualizados = materiales.filter((_, i) => i !== index);
    await updateDoc(doc(db, "maquinas", "lasermex"), {
      materiales: actualizados,
    });
    fetchData(); // Recargar desde Firestore
  };

  const actualizarQS = async (nuevaURL: string) => {
    const ref = doc(db, "maquinas", "lasermex");
    await updateDoc(ref, { qs: nuevaURL });
    fetchData(); // Recargar desde Firestore
  };

  return (
    <div className="bg-black text-white p-8 rounded-lg max-w-4xl mx-auto">
      {/* Botón de regreso */}
      <div className="max-w-6xl mx-auto mb-6">
        <button
          onClick={() => window.history.back()}
          className="mb-4 bg-white text-black px-4 py-2 rounded flex items-center gap-2 hover:bg-black-200"
        >
          <FiArrowLeft /> Regresar
        </button>
      </div>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl TEXT-CENTER font-bold mb-6">Lasermex</h1>

        <img
          src="/lasermex.png"
          alt="Lasermex"
          className="w-full h-auto max-w-md rounded mb-6 shadow"
        />
        <p className="mb-6">
          La Lasermex Gazela es una cortadora láser de alta precisión diseñada
          para trabajos de grabado y corte en una amplia variedad de materiales.
          Es ideal para prototipado rápido, fabricación de piezas personalizadas
          y diseño industrial. Su diseño robusto y software intuitivo la
          convierten en una herramienta confiable para usuarios técnicos y
          creativos.
        </p>

        <p className="mb-6">
          Cuenta con un área de trabajo de 600 x 400 mm y un láser CO₂ de 60W,
          lo que le permite trabajar con materiales como acrílico, MDF, madera
          natural, cartón, cuero y tela. Ofrece una velocidad de corte de hasta
          500 mm/s y una resolución de 1000 DPI, garantizando acabados precisos
          y profesionales.
        </p>

        <p className="mb-6">
          No es apta para cortar metales ni plásticos que contengan cloro como
          el PVC. Su uso es común en fabricación de maquetas, corte de piezas
          para ensambles, grabado de logotipos y personalización de productos.
        </p>

        {/* TABLA PARÁMETROS DE CORTE */}
        <h2 className="text-xl font-semibold mb-2">
          Parámetros de corte (60W)
        </h2>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm border border-white/20">
            <thead>
              <tr className="bg-white/10">
                <th className="px-3 py-2 text-left">Material</th>
                <th className="px-3 py-2 text-left">Velocidad</th>
                <th className="px-3 py-2 text-left">Potencia</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-white/10">
                <td className="px-3 py-1">MDF 2&nbsp;mm</td>
                <td className="px-3 py-1">12&nbsp;mm/s</td>
                <td className="px-3 py-1">100%</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-1">MDF 3&nbsp;mm</td>
                <td className="px-3 py-1">9&nbsp;mm/s</td>
                <td className="px-3 py-1">100%</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-1">MDF 4&nbsp;mm</td>
                <td className="px-3 py-1">7&nbsp;mm/s</td>
                <td className="px-3 py-1">100%</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-1">MDF 6&nbsp;mm</td>
                <td className="px-3 py-1">5&nbsp;mm/s</td>
                <td className="px-3 py-1">100%</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-1">Acrílico 4&nbsp;mm</td>
                <td className="px-3 py-1">12&nbsp;mm/s</td>
                <td className="px-3 py-1">100%</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-1">Acrílico 6&nbsp;mm</td>
                <td className="px-3 py-1">8–10&nbsp;mm/s</td>
                <td className="px-3 py-1">100%</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-1">Acrílico 9&nbsp;mm</td>
                <td className="px-3 py-1">4–6&nbsp;mm/s</td>
                <td className="px-3 py-1">100%</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-1">Acrílico 12&nbsp;mm</td>
                <td className="px-3 py-1">2–3&nbsp;mm/s</td>
                <td className="px-3 py-1">100%</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-1">Tela</td>
                <td className="px-3 py-1">100&nbsp;mm/s</td>
                <td className="px-3 py-1">100%</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-1">Papel</td>
                <td className="px-3 py-1">150&nbsp;mm/s</td>
                <td className="px-3 py-1">100%</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-1">Cartón</td>
                <td className="px-3 py-1">15–30&nbsp;mm/s</td>
                <td className="px-3 py-1">100%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* TABLA PARÁMETROS DE GRABADO */}
        <h2 className="text-xl font-semibold mb-2">
          Parámetros de grabado
        </h2>
        <div className="overflow-x-auto mb-8">
          <table className="w-full text-sm border border-white/20">
            <thead>
              <tr className="bg-white/10">
                <th className="px-3 py-2 text-left">Material</th>
                <th className="px-3 py-2 text-left">Velocidad</th>
                <th className="px-3 py-2 text-left">Potencia</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-white/10">
                <td className="px-3 py-1">Mármol</td>
                <td className="px-3 py-1">250&nbsp;mm/s</td>
                <td className="px-3 py-1">40%</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-1">Cristal</td>
                <td className="px-3 py-1">250&nbsp;mm/s</td>
                <td className="px-3 py-1">30%</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-1">Madera</td>
                <td className="px-3 py-1">150–300&nbsp;mm/s</td>
                <td className="px-3 py-1">30–40%</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-1">Papel</td>
                <td className="px-3 py-1">200–300&nbsp;mm/s</td>
                <td className="px-3 py-1">35%</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-1">Acrílico</td>
                <td className="px-3 py-1">400&nbsp;mm/s</td>
                <td className="px-3 py-1">50%</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-1">MDF</td>
                <td className="px-3 py-1">400&nbsp;mm/s</td>
                <td className="px-3 py-1">60%</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-1">Gravoply</td>
                <td className="px-3 py-1">600&nbsp;mm/s</td>
                <td className="px-3 py-1">40%</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-1">
                  Marcado en metal con Cermark
                </td>
                <td className="px-3 py-1">200&nbsp;mm/s</td>
                <td className="px-3 py-1">100%</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-1">Sellos de goma</td>
                <td className="px-3 py-1">160&nbsp;mm/s</td>
                <td className="px-3 py-1">100%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* MATERIALES DISPONIBLES */}
        <h2 className="text-xl font-semibold mb-2">
          Materiales disponibles:
        </h2>
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
              className="border px-2 py-1 rounded text-gray"
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
            className="text-blue-400 underline"
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
              className="border px-2 py-1 rounded w-full text-gray"
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
