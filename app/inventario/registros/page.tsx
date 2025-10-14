"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/src/firebase/firebaseConfig";
import { useAuth } from "@/src/Context/AuthContext";

type Movement = {
  consumibleTitulo: string;
  consumibleIndex?: number;
  proyecto: string;
  userId: string;
  userName: string;
  cantidadTomada: number;
  fecha?: any; // Firestore Timestamp | string | Date
};

function formatFecha(fecha: any) {
  try {
    if (!fecha) return "—";
    let d: Date;
    if (typeof fecha?.toDate === "function") d = fecha.toDate();
    else if (typeof fecha === "string") d = new Date(fecha);
    else if (fecha instanceof Date) d = fecha;
    else if (typeof fecha?.seconds === "number") d = new Date(fecha.seconds * 1000);
    else return "—";
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

export default function RegistrosInventarioPage() {
  const { isAdmin } = useAuth();
  const [movs, setMovs] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, "inventory_movements"), orderBy("fecha", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => d.data() as Movement);
      setMovs(data);
      setLoading(false);
    });
    return () => unsub();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return movs;
    return movs.filter((m) => {
      const texto = `${m.consumibleTitulo ?? ""} ${m.proyecto ?? ""} ${m.userName ?? ""}`.toLowerCase();
      return texto.includes(s);
    });
  }, [movs, search]);

  // Si no es admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen px-6 py-10 bg-gray-600">
        <div className="max-w-7xl mx-auto bg-white text-black rounded-2xl p-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-xl font-bold">Registros de inventario</h1>
            <button
              onClick={() => window.history.back()}
              className="bg-black text-white px-4 py-2 rounded hover:opacity-90"
            >
              ← Regresar
            </button>
          </div>
          <p className="text-sm text-gray-700">
            No tienes permisos para ver esta sección.
          </p>
        </div>
      </div>
    );
  }

  // Vista admin
  return (
    <div className="min-h-screen px-6 py-10 bg-gray-600">
      <div className="max-w-7xl mx-auto bg-white text-black rounded-2xl p-6">
        {/* Encabezado */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold">Registros de inventario</h1>
          <button
            onClick={() => window.history.back()}
            className="bg-black text-white px-4 py-2 rounded hover:opacity-90"
          >
            ← Regresar
          </button>
        </div>

        {/* Barra de búsqueda */}
        <div className="mb-4 flex items-center gap-3">
          <input
            type="text"
            placeholder="Buscar por consumible, proyecto o usuario…"
            className="w-full max-w-md border rounded px-3 py-2 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="text-xs text-gray-600">
            {loading ? "Cargando…" : `${filtered.length} registro(s)`}
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-auto border rounded-xl">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Fecha</th>
                <th className="text-left px-4 py-2 font-semibold">Consumible</th>
                <th className="text-left px-4 py-2 font-semibold">Proyecto</th>
                <th className="text-left px-4 py-2 font-semibold">Usuario</th>
                <th className="text-right px-4 py-2 font-semibold">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{formatFecha(m.fecha)}</td>
                  <td className="px-4 py-2">{m.consumibleTitulo || "—"}</td>
                  <td className="px-4 py-2">{m.proyecto || "—"}</td>
                  <td className="px-4 py-2">{m.userName || "—"}</td>
                  <td className="px-4 py-2 text-right">
                    {m.cantidadTomada ?? "—"}
                  </td>
                </tr>
              ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-gray-500 text-sm"
                  >
                    No se encontraron registros
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
