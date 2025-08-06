"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getDocs,
  collection,
  query,
  where,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../src/firebase/firebaseConfig";
import { useAuth } from "../../../src/Context/AuthContext";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";


export default function ListadoPedidosPage() {
  const searchParams = useSearchParams();
  const proyectoSeleccionado = searchParams.get("proyecto");
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const router = useRouter();

  const esAdmin =
    user?.email === "jahaziel@bioana.com" ||
    user?.email === "manuel@bioana.com";

  useEffect(() => {
    if (!proyectoSeleccionado || !user) return;

    const cargarPedidos = async () => {
      const q = query(
        collection(db, "pedidos"),
        where("usuario", "==", user.email),
        where("proyecto", "==", proyectoSeleccionado)
      );

      const querySnapshot = await getDocs(q);
      const lista = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPedidos(lista);
    };

    cargarPedidos();
  }, [user, proyectoSeleccionado]);

  const handleSeleccionar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const id = e.target.value;
    if (e.target.checked) {
      setSeleccionados((prev) => [...prev, id]);
    } else {
      setSeleccionados((prev) => prev.filter((pid) => pid !== id));
    }
  };

  const crearCarpeta = async (ids: string[]) => {
    const nombre = prompt("Nombre de la carpeta:");
    if (!nombre || ids.length === 0) return;

    try {
      await addDoc(collection(db, "carpetas"), {
        nombre,
        creador: user?.email,
        proyecto: proyectoSeleccionado,
        pedidos: ids,
        timestamp: serverTimestamp(),
      });
      alert("Carpeta creada con éxito");
    } catch (err) {
      console.error("Error al crear carpeta:", err);
      alert("Hubo un error al crear la carpeta.");
    }
  };

  const actualizarCampo = async (id: string, campo: string, valor: any) => {
    try {
      const ref = doc(db, "pedidos", id);
      await updateDoc(ref, { [campo]: valor });
      setPedidos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p))
      );
    } catch (err) {
      console.error("Error actualizando", campo, err);
    }
  };

  const subirArchivoCosto = async (
  e: React.ChangeEvent<HTMLInputElement>,
  id: string
) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const fileRef = storageRef(storage, `costos/${id}/${file.name}`);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);

    await actualizarCampo(id, "costo", url);
  } catch (err) {
    console.error("Error subiendo archivo de costo:", err);
    alert("No se pudo subir el archivo.");
  }
};


  if (!user || !proyectoSeleccionado) return null;

  return (
     <Suspense fallback={<div className="text-center py-10">Cargando...</div>}>
    <div>
      <button
        onClick={() => router.push("/solicitudes")}
        className="mb-6 bg-white text-black px-4 py-2 rounded hover:bg-gray-200 flex items-center gap-2"
      >
        <FiArrowLeft /> Regresar
      </button>

      <h1 className="text-xl font-semibold mb-4">
        Pedidos del proyecto:{" "}
        <span className="capitalize">{proyectoSeleccionado}</span>
      </h1>

      {pedidos.length === 0 ? (
        <p>No hay pedidos registrados para este proyecto.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white text-black rounded shadow-md">
            <thead>
              <tr className="bg-gray-200 text-left">
                <th className="py-2 px-4">Título</th>
                <th className="py-2 px-4">Detalles</th>
                <th className="py-2 px-4">Entrega propuesta</th>
                <th className="py-2 px-4">Entrega real</th>
                <th className="py-2 px-4">Cotización</th>
                <th className="py-2 px-4">Status</th>
                
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="py-2 px-4">{p.titulo || "Sin título"}</td>
                  <td className="py-2 px-4">
                    <Link
                      href={`/solicitudes/listado/${p.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Ver detalles
                    </Link>
                  </td>
                  <td className="py-2 px-4">{p.fechaLimite}</td>
                  <td className="py-2 px-4">
                    {esAdmin ? (
                      <input
                        type="date"
                        value={p.fechaEntregaReal || ""}
                        onChange={(e) =>
                          actualizarCampo(
                            p.id,
                            "fechaEntregaReal",
                            e.target.value
                          )
                        }
                        className="px-2 py-1 border rounded text-black"
                      />
                    ) : (
                      p.fechaEntregaReal || "Pendiente"
                    )}
                  </td>
                  <td className="px-4 py-2">
  {p.costo && p.nombreCosto ? (
    <div className="flex items-center gap-2">
      <a
        href={p.costo}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline"
      >
        {p.nombreCosto}
      </a>
      {esAdmin && (
        <button
          onClick={() => {
            actualizarCampo(p.id, "costo", "");
            actualizarCampo(p.id, "nombreCosto", "");
          }}
          className="text-red-600 hover:text-red-800 text-lg"
        >
          &times;
        </button>
      )}
    </div>
  ) : esAdmin ? (
    <input
      type="file"
      accept=".pdf,.doc,.docx,.xls,.xlsx"
      onChange={(e) => subirArchivoCosto(e, p.id)}
      className="text-sm text-black"
    />
  ) : (
    <span>Pendiente</span>
  )}
</td>

                  <td className="py-2 px-4">
                    {esAdmin ? (
                      <select
                        value={p.status || "enviado"}
                        onChange={(e) =>
                          actualizarCampo(p.id, "status", e.target.value)
                        }
                        className="px-2 py-1 border rounded text-black"
                      >
                        <option value="enviado">Enviado</option>
                        <option value="visto">Visto</option>
                        <option value="en proceso">En proceso</option>
                        <option value="listo">Listo</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    ) : (
                      <span className="capitalize">
                        {p.status || "enviado"}
                      </span>
                    )}
                  </td>
                
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {seleccionados.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => crearCarpeta(seleccionados)}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Crear carpeta con {seleccionados.length} pedidos
          </button>
        </div>
      )}
    </div>
    </Suspense>
  );
}
