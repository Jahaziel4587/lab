"use client";

import { useEffect, useState } from "react";
import { db, storage } from "@/src/firebase/firebaseConfig";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import {
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  format,
  isSameDay,
} from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { useAuth } from "@/src/Context/AuthContext";
import { adminEmails } from "@/src/config/admins";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";


type Pedido = {
  id: string;
  titulo: string;
  fechaEntregaReal?: string;
  fechaLimite?: string;
  costo?: string;
  status?: string;
  nombreCosto?: string;
  correoUsuario?: string;
  nombreUsuario?: string;
};

export default function CalendarioPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [diasDelMes, setDiasDelMes] = useState<Date[]>([]);
  const { user } = useAuth();
  const hoy = new Date();
  const esAdmin = !!user?.email && adminEmails.includes(user.email);
  const [nameByEmail, setNameByEmail] = useState<Record<string, string>>({});
  const {isAdmin} = useAuth();


  useEffect(() => {
  const obtenerPedidos = async () => {
    // 1️⃣ Obtener todos los usuarios para mapear email → nombre completo
    const usuariosSnap = await getDocs(collection(db, "users"));
    const nameByEmail: Record<string, string> = {};
    usuariosSnap.forEach((docu) => {
      const d = docu.data() as any;
      if (d?.email) {
        nameByEmail[d.email] = [d?.nombre, d?.apellido].filter(Boolean).join(" ") || d.email;
      }
    });

    // 2️⃣ Obtener pedidos
    const q = query(collection(db, "pedidos"), orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(q);
    const pedidosData: Pedido[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      pedidosData.push({
        id: docSnap.id,
        titulo: data.titulo || "Sin título",
        fechaEntregaReal: data.fechaEntregaReal || "",
        fechaLimite: data.fechaLimite || "",
        costo: data.costo || "",
        nombreCosto: data.nombreCosto || "",
        status: data.status || "enviado",
        correoUsuario: data.correoUsuario || "",
        // 👇 Nuevo: nombre completo del usuario
        nombreUsuario: nameByEmail[data.correoUsuario] || data.correoUsuario || "",
      });
    });

    setPedidos(pedidosData);
  };


    obtenerPedidos();

    const inicioMes = startOfMonth(hoy);
    const finMes = endOfMonth(hoy);
    const dias = eachDayOfInterval({ start: inicioMes, end: finMes });
    setDiasDelMes(dias);
  }, []);

  const actualizarCampo = async (id: string, campo: string, valor: string) => {
    try {
      const ref = doc(db, "pedidos", id);
      await updateDoc(ref, { [campo]: valor });
      setPedidos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p))
      );
    } catch (error) {
      console.error("Error al actualizar campo:", error);
    }
  };

  const subirArchivoCosto = async (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileRef = storageRef(storage, `costos/${id}/${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      await actualizarCampo(id, "costo", url);
      await actualizarCampo(id, "nombreCosto", file.name);
    } catch (err) {
      console.error("Error subiendo archivo de costo:", err);
      alert("No se pudo subir el archivo.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto bg-white text-black p-6 rounded-xl shadow space-y-6">
      <h1 className="text-xl font-bold text-center">Calendario de Pedidos</h1>

      <div className="grid grid-cols-7 gap-2 text-sm">
        {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((dia) => (
          <div key={dia} className="text-center font-semibold">
            {dia}
          </div>
        ))}

        {(() => {
          const primerDia = diasDelMes.length > 0 ? diasDelMes[0].getDay() : 0;
          const espacios = Array(primerDia).fill(null);
          return [...espacios, ...diasDelMes].map((dia, i) => {
            if (!dia) return <div key={`empty-${i}`} />;
            const pedidosDelDia = pedidos.filter((p) =>
              p.fechaEntregaReal
                ? isSameDay(new Date(p.fechaEntregaReal + "T00:00:00"), dia)
                : false
            );

            return (
              <div
                key={dia.toISOString()}
                className="border p-2 rounded h-28 overflow-auto"
              >
                <div className="font-semibold">
                  {format(dia, "d", { locale: es })}
                </div>
                <div className="text-xs mt-1 space-y-1">
                  {pedidosDelDia.map((p) => (
                    <div key={p.id} className="truncate">
                      {isAdmin ? (
                        <Link
                          href={`/solicitudes/listado/${p.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {p.titulo}
                        </Link>
                      ) : (
                        <span>{p.titulo}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          });
        })()}
      </div>

      {isAdmin && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold mb-4">Todos los pedidos</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm bg-white text-black rounded shadow-md">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2">Título</th>
                  <th className="px-4 py-2">Solicitante</th>
                  <th className="px-4 py-2">Fecha propuesta</th>
                  <th className="px-4 py-2">Fecha real</th>
                  <th className="px-4 py-2">Cotización</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Detalles</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2">{p.titulo}</td>
                    <td className="px-4 py-2">
                      {p.nombreUsuario || p.correoUsuario|| "Sin información"}
                    </td>
                    <td className="px-4 py-2">{p.fechaLimite || "No definida"}</td>
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        value={p.fechaEntregaReal ?? ""}
                        onChange={(e) =>
                          actualizarCampo(p.id, "fechaEntregaReal", e.target.value)
                        }
                        className="border px-2 py-1 rounded"
                      />
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
                          <button
                            onClick={() => {
                              actualizarCampo(p.id, "costo", "");
                              actualizarCampo(p.id, "nombreCosto", "");
                            }}
                            className="text-red-600 hover:text-red-800 text-lg"
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
                        onChange={(e) =>
                          actualizarCampo(p.id, "status", e.target.value)
                        }
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
                      <Link
                        href={`/solicitudes/listado/${p.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        Ver detalles
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
