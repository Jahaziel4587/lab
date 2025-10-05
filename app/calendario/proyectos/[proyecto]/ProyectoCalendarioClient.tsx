"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/src/Context/AuthContext";
import { db, storage } from "@/src/firebase/firebaseConfig";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

type Pedido = {
  id: string;
  titulo: string;
  proyecto?: string;
  fechaEntregaReal?: string;
  fechaLimite?: string;
  status?: string;
  correoUsuario?: string;
  nombreUsuario?: string;
  costo?: string;
  nombreCosto?: string;
};

export default function ProyectoCalendarioClient({ proyecto }: { proyecto: string }) {
  const { isAdmin } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [nameByEmail, setNameByEmail] = useState<Record<string, string>>({});

  // Helpers
  const actualizarCampo = async (id: string, campo: string, valor: string) => {
    const ref = doc(db, "pedidos", id);
    await updateDoc(ref, { [campo]: valor });
    setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)));
  };

  const subirArchivoCosto = async (
    e: React.ChangeEvent<HTMLInputElement>,
    id: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileRef = storageRef(storage, `costos/${id}/${file.name}`);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    await actualizarCampo(id, "costo", url);
    await actualizarCampo(id, "nombreCosto", file.name);
  };

  // Cargar usuarios (mapa nombre completo) + pedidos del proyecto
  useEffect(() => {
    if (!isAdmin) return;

    const cargar = async () => {
      // 1) Mapear email -> nombre completo desde "users"
      const usuariosSnap = await getDocs(collection(db, "users"));
      const map: Record<string, string> = {};
      usuariosSnap.forEach((docu) => {
        const u = docu.data() as any;
        if (u?.email) {
          map[u.email] = [u?.nombre, u?.apellido].filter(Boolean).join(" ") || u.email;
        }
      });
      setNameByEmail(map);

      // 2) Traer pedidos del proyecto
      const qPed = query(collection(db, "pedidos"), where("proyecto", "==", proyecto));
      const snap = await getDocs(qPed);

      const data: Pedido[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data() as any;
        data.push({
          id: docSnap.id,
          titulo: d.titulo || "Sin título",
          proyecto: d.proyecto || "Sin proyecto",
          fechaEntregaReal: d.fechaEntregaReal || "",
          fechaLimite: d.fechaLimite || "",
          status: d.status || "enviado",
          correoUsuario: d.correoUsuario || "",
          // 👇 usa el mismo formato de nombre que en el calendario general
          nombreUsuario: map[d.correoUsuario] || d.nombreUsuario || d.correoUsuario || "",
          costo: d.costo || "",
          nombreCosto: d.nombreCosto || "",
        });
      });

      setPedidos(
        data
          .filter((p) => p.fechaEntregaReal && p.fechaEntregaReal.trim() !== "")
          .sort((a, b) => (a.fechaEntregaReal! < b.fechaEntregaReal! ? -1 : 1))
      );
    };

    cargar();
  }, [isAdmin, proyecto]);

  const total = useMemo(() => pedidos.length, [pedidos]);

  const fileLabel = (p: Pedido) =>
    p.nombreCosto ||
    (p.costo
      ? decodeURIComponent(p.costo.split("/").pop()?.split("?")[0] || "archivo")
          .split("%2F")
          .pop()
      : "");

  if (!isAdmin) {
    return (
      <div className="max-w-5xl mx-auto bg-white text-black p-6 rounded-xl shadow">
        <p>No autorizado.</p>
        <Link href="/calendario" className="text-blue-600 underline">Volver al calendario</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto bg-white text-black p-6 rounded-xl shadow space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/calendario" className="text-blue-600 hover:underline">← Volver</Link>
        <h1 className="text-lg font-semibold truncate">Pedidos fechados — {proyecto}</h1>
        <span className="text-sm text-gray-500">{total} pedido{total === 1 ? "" : "s"}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm bg-white rounded shadow">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">Título</th>
              <th className="px-4 py-2 text-left">Solicitante</th>
              <th className="px-4 py-2 text-left">Fecha propuesta</th>
              <th className="px-4 py-2 text-left">Fecha real</th>
              <th className="px-4 py-2 text-left">Cotización</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Detalles</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">{p.titulo}</td>
                <td className="px-4 py-2">{p.nombreUsuario || p.correoUsuario || "-"}</td>
                <td className="px-4 py-2">{p.fechaLimite || "-"}</td>
                <td className="px-4 py-2">
                  <input
                    type="date"
                    value={p.fechaEntregaReal ?? ""}
                    onChange={(e) => actualizarCampo(p.id, "fechaEntregaReal", e.target.value)}
                    className="border px-2 py-1 rounded"
                  />
                </td>
                <td className="px-4 py-2">
                  {p.costo ? (
                    <div className="flex items-center gap-2">
                      <a href={p.costo} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                        {fileLabel(p)}
                      </a>
                      <button
                        onClick={() => {
                          actualizarCampo(p.id, "costo", "");
                          actualizarCampo(p.id, "nombreCosto", "");
                        }}
                        className="text-red-600 hover:text-red-800 text-lg"
                        title="Eliminar archivo"
                      >
                        &times;
                      </button>
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => subirArchivoCosto(e, p.id)}
                      className="text-sm text-black"
                    />
                  )}
                </td>
                <td className="px-4 py-2">
                  <select
                    value={p.status || "enviado"}
                    onChange={(e) => actualizarCampo(p.id, "status", e.target.value)}
                    className="border px-2 py-1 rounded"
                  >
                    <option value="enviado">Enviado</option>
                    <option value="visto">Visto</option>
                    <option value="en proceso">En proceso</option>
                    <option value="listo">Listo</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </td>
                <td className="px-4 py-2">
                  <Link href={`/solicitudes/listado/${p.id}`} className="text-blue-600 hover:underline">
                    Ver detalles
                  </Link>
                </td>
              </tr>
            ))}
            {pedidos.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>
                  No hay pedidos con fecha real en este proyecto.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
