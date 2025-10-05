"use client";

import { useEffect, useMemo, useState } from "react";
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
  addMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/src/Context/AuthContext";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

type Pedido = {
  id: string;
  titulo: string;
  proyecto?: string;
  fechaEntregaReal?: string; // ISO yyyy-MM-dd
  fechaLimite?: string;      // ISO yyyy-MM-dd
  costo?: string;
  status?: string;
  nombreCosto?: string;
  correoUsuario?: string;
  nombreUsuario?: string;
};

// Opcional: mismas imágenes que usas en /solicitudes
const proyectosImagenes: { [k: string]: string } = {
  "001.Ocumetics": "/ocumetics.jpeg",
  "002.Labella": "/Bioana.jpeg",
  "003.XSONXS": "/XSONX.png",
  "004.Solvein": "/Bioana.jpeg",
  "005.XSONXS wound heads": "/XSONX.png",
  "006.AGMI": "/Bioana.jpeg",
  "007.LumeNXT": "/LumeNXT.jpg",
  "008.Panter": "/Bioana.jpeg",
  "009.Recopad": "/Bioana.jpeg",
  "010.Juno": "/Bioana.jpeg",
  "012.Neurocap": "/Bioana.jpeg",
  "013.T-EZ": "/Bioana.jpeg",
  "014.QIK Cap handle": "/Bioana.jpeg",
  "015.QIK Cap disponible": "/Bioana.jpeg",
  "016.Portacad shield": "/Bioana.jpeg",
  "027.XSCRUB": "/Bioana.jpeg",
  "029.Zipstich": "/Bioana.jpeg",
  "030.MUV": "/Bioana.jpeg",
  "E001.Avarie Menstrual Pads": "/Bioana.jpeg",
  "E002.Hero Cap": "/Bioana.jpeg",
  "E003.Injectable Dermis": "/Bioana.jpeg",
  "E004.DiViDiaper": "/Bioana.jpeg",
  "E006.Structural Heart": "/Bioana.jpeg",
  "E007.Leg wrap": "/Bioana.jpeg",
  "E009.InjectMate": "/Bioana.jpeg",
  "E010.Orthodoxo": "/Bioana.jpeg",
  "E011.Orthodoxo Anclas": "/Bioana.jpeg",
  "E012.Falcon View": "/Bioana.jpeg",
  "E013.Birchconcepts": "/Bioana.jpeg",
  "E015.Sport Care": "/Bioana.jpeg",
};

export default function CalendarioPage() {
  const { isAdmin } = useAuth();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [diasDelMes, setDiasDelMes] = useState<Date[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [nameByEmail, setNameByEmail] = useState<Record<string, string>>({});

  // Cargar pedidos + mapa de nombres
  useEffect(() => {
    const obtenerPedidos = async () => {
      // 1) Mapear usuarios (email -> nombre completo)
      const usuariosSnap = await getDocs(collection(db, "users"));
      const _nameByEmail: Record<string, string> = {};
      usuariosSnap.forEach((docu) => {
        const d = docu.data() as any;
        if (d?.email) {
          _nameByEmail[d.email] =
            [d?.nombre, d?.apellido].filter(Boolean).join(" ") || d.email;
        }
      });
      setNameByEmail(_nameByEmail);

      // 2) Obtener pedidos
      const qPed = query(collection(db, "pedidos"), orderBy("timestamp", "desc"));
      const snap = await getDocs(qPed);

      const pedidosData: Pedido[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        pedidosData.push({
          id: docSnap.id,
          titulo: data.titulo || "Sin título",
          proyecto: data.proyecto || "Sin proyecto",
          fechaEntregaReal: data.fechaEntregaReal || "",
          fechaLimite: data.fechaLimite || "",
          costo: data.costo || "",
          nombreCosto: data.nombreCosto || "",
          status: data.status || "enviado",
          correoUsuario: data.correoUsuario || "",
          nombreUsuario: _nameByEmail[data.correoUsuario] || data.correoUsuario || "",
        });
      });

      setPedidos(pedidosData);
    };

    obtenerPedidos();
  }, []);

  // Recalcular días cuando cambie el mes visible
  useEffect(() => {
    const inicioMes = startOfMonth(currentMonth);
    const finMes = endOfMonth(currentMonth);
    setDiasDelMes(eachDayOfInterval({ start: inicioMes, end: finMes }));
  }, [currentMonth]);

  // Navegación de meses
  const goPrevMonth = () => setCurrentMonth((d) => addMonths(d, -1));
  const goNextMonth = () => setCurrentMonth((d) => addMonths(d, +1));

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
      await actualizarCampo(id, "nombreCosto", file.name);
    } catch (err) {
      console.error("Error subiendo archivo de costo:", err);
      alert("No se pudo subir el archivo.");
    }
  };

  // 1) Tabla "Todos los pedidos" -> SOLO los que NO tienen fechaEntregaReal
  const pedidosSinFecha = useMemo(
    () => pedidos.filter((p) => !p.fechaEntregaReal || p.fechaEntregaReal.trim() === ""),
    [pedidos]
  );

  // 2) Tarjetas por proyecto -> SOLO los que SÍ tienen fechaEntregaReal
  const proyectosConFecha = useMemo(() => {
    const map = new Map<string, number>();
    pedidos
      .filter((p) => p.fechaEntregaReal && p.fechaEntregaReal.trim() !== "")
      .forEach((p) => {
        const key = p.proyecto || "Sin proyecto";
        map.set(key, (map.get(key) || 0) + 1);
      });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [pedidos]);

  return (
    <div className="max-w-6xl mx-auto bg-white text-black p-6 rounded-xl shadow space-y-10">
      {/* Header con navegación de meses */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrevMonth}
          className="px-3 py-1 rounded-lg border hover:bg-gray-50"
          aria-label="Mes anterior"
        >
          ◀
        </button>
        <h1 className="text-xl font-bold text-center">
          Calendario de Pedidos — {format(currentMonth, "MMMM yyyy", { locale: es })}
        </h1>
        <button
          onClick={goNextMonth}
          className="px-3 py-1 rounded-lg border hover:bg-gray-50"
          aria-label="Mes siguiente"
        >
          ▶
        </button>
      </div>

      {/* CABECERAS DÍAS + CUADRÍCULA */}
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
                    <div key={p.id} className="truncate" title={p.titulo}>
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

      {/* TABLA GENERAL: SOLO pedidos SIN fecha real */}
      {isAdmin && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Pedidos pendientes de fecha</h2>
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
                {pedidosSinFecha.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2">{p.titulo}</td>
                    <td className="px-4 py-2">
                      {p.nombreUsuario || p.correoUsuario || "Sin información"}
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
                {pedidosSinFecha.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>
                      No hay pedidos pendientes de asignar fecha.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TARJETAS POR PROYECTO: pedidos CON fecha real */}
      {isAdmin && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Proyectos con pedidos fechados</h2>
          {proyectosConFecha.length === 0 ? (
            <p className="text-sm text-gray-600">
              Aún no hay pedidos con <em>fecha real</em>.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {proyectosConFecha.map(([proyecto, count]) => (
                <Link
                  key={proyecto}
                  href={`/calendario/proyectos/${encodeURIComponent(proyecto)}`}
                  className="relative rounded-xl overflow-hidden shadow-lg group"
                >
                  <Image
                    src={proyectosImagenes[proyecto] || "/otro.jpg"}
                    alt={proyecto}
                    width={500}
                    height={300}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute bottom-3 left-3 right-3 bg-white text-black rounded-full px-4 py-1 flex justify-between items-center">
                    <span className="text-sm font-medium truncate">{proyecto}</span>
                    <span className="text-xs opacity-70">{count}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
