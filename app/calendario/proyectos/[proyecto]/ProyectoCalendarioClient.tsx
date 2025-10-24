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
  getDoc,
  setDoc,
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
  subtotalBaseMXN?: number; // suma base de la cotización viva
};

type Usuario = {
  email: string;
  nombre: string;
  uid?: string;
};

function formatMoney(n?: number) {
  const v = Number(n || 0);
  return `MXN ${v.toFixed(2)}`;
}

export default function ProyectoCalendarioClient({ proyecto }: { proyecto: string }) {
  const { isAdmin } = useAuth();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [nameByEmail, setNameByEmail] = useState<Record<string, string>>({});

  // --- Compartir proyecto ---
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  const [abiertoCompartir, setAbiertoCompartir] = useState(false);
  const [guardandoShare, setGuardandoShare] = useState(false);
  const [cargandoShare, setCargandoShare] = useState(true);
  // --------------------------

  // Helpers (se mantienen aunque ya no se use el upload)
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

  // Cargar usuarios + pedidos + sharing
  useEffect(() => {
    if (!isAdmin) return;

    const cargar = async () => {
      // 1) Usuarios
      const usuariosSnap = await getDocs(collection(db, "users"));
      const map: Record<string, string> = {};
      const listaUsuarios: Usuario[] = [];

      usuariosSnap.forEach((docu) => {
        const u = docu.data() as any;
        if (u?.email) {
          const nombre =
            [u?.nombre, u?.apellido].filter(Boolean).join(" ") ||
            u?.displayName ||
            u.email;
          map[u.email] = nombre;
          listaUsuarios.push({ email: u.email, nombre, uid: u?.uid });
        }
      });

      setNameByEmail(map);
      setUsuarios(listaUsuarios.sort((a, b) => a.nombre.localeCompare(b.nombre)));

      // 2) Pedidos del proyecto
      const qPed = query(collection(db, "pedidos"), where("proyecto", "==", proyecto));
      const snap = await getDocs(qPed);

      const basePedidos: Pedido[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data() as any;
        basePedidos.push({
          id: docSnap.id,
          titulo: d.titulo || "Sin título",
          proyecto: d.proyecto || "Sin proyecto",
          fechaEntregaReal: d.fechaEntregaReal || "",
          fechaLimite: d.fechaLimite || "",
          status: d.status || "enviado",
          correoUsuario: d.correoUsuario || "",
          nombreUsuario: map[d.correoUsuario] || d.nombreUsuario || d.correoUsuario || "",
          costo: d.costo || "",
          nombreCosto: d.nombreCosto || "",
        });
      });

      // 2b) Sumar subtotal base (cotización viva)
      const withSubtotals: Pedido[] = await Promise.all(
        basePedidos.map(async (p) => {
          try {
            const linesRef = collection(db, "pedidos", p.id, "quote_live", "live", "lines");
            const linesSnap = await getDocs(linesRef);
            let subtotal = 0;
            linesSnap.forEach((ln) => {
              const ld = ln.data() as any;
              const val = Number(ld?.subtotalMXN || 0);
              if (Number.isFinite(val)) subtotal += val;
            });
            return { ...p, subtotalBaseMXN: subtotal };
          } catch {
            return { ...p, subtotalBaseMXN: 0 };
          }
        })
      );

      setPedidos(
        withSubtotals
          .filter((p) => p.fechaEntregaReal && p.fechaEntregaReal.trim() !== "")
          .sort((a, b) => (a.fechaEntregaReal! < b.fechaEntregaReal! ? -1 : 1))
      );

      // 3) Compartición
      setCargandoShare(true);
      const shareRef = doc(db, "proyectos_shares", proyecto);
      const shareSnap = await getDoc(shareRef);
      if (shareSnap.exists()) {
        const datos = shareSnap.data() as any;
        const arr: string[] = Array.isArray(datos?.users) ? datos.users : [];
        setSeleccionados(new Set(arr));
      } else {
        setSeleccionados(new Set());
      }
      setCargandoShare(false);
    };

    cargar();
  }, [isAdmin, proyecto]);

  const total = useMemo(() => pedidos.length, [pedidos]);

  const totalProyectoMXN = useMemo(
    () => pedidos.reduce((acc, p) => acc + (p.subtotalBaseMXN || 0), 0),
    [pedidos]
  );

  const fileLabel = (p: Pedido) =>
    p.nombreCosto ||
    (p.costo
      ? decodeURIComponent(p.costo.split("/").pop()?.split("?")[0] || "archivo")
          .split("%2F")
          .pop()
      : "");

  const toggleSeleccion = (email: string) => {
    setSeleccionados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(email)) nuevo.delete(email);
      else nuevo.add(email);
      return nuevo;
    });
  };

  const guardarCompartir = async () => {
    try {
      setGuardandoShare(true);
      const shareRef = doc(db, "proyectos_shares", proyecto);
      await setDoc(
        shareRef,
        { users: Array.from(seleccionados), actualizadoEn: new Date().toISOString() },
        { merge: true }
      );
      setAbiertoCompartir(false);
    } finally {
      setGuardandoShare(false);
    }
  };

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) =>
        u.nombre.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [usuarios, busqueda]);

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
      <div className="flex items-center justify-between gap-3">
        <Link href="/calendario" className="text-blue-600 hover:underline">← Volver</Link>

        <h1 className="text-lg font-semibold truncate">Pedidos fechados — {proyecto}</h1>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{total} pedido{total === 1 ? "" : "s"}</span>
          <button
            onClick={() => setAbiertoCompartir(true)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm"
            title="Compartir este proyecto con usuarios específicos"
          >
            Compartir proyecto
          </button>
        </div>
      </div>

      {/* Tabla con botón Ver Cotización Viva en lugar de subir archivo */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white text-black rounded shadow-md text-sm">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="py-2 px-4">Título</th>
              <th className="py-2 px-4">Solicitante</th>
              <th className="py-2 px-4">Fecha propuesta</th>
              <th className="py-2 px-4">Fecha real</th>
              <th className="py-2 px-4">Costos</th>
              <th className="py-2 px-4">Cotización</th>
              <th className="py-2 px-4">Status</th>
              <th className="py-2 px-4">Detalles</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id} className="border-t align-top">
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

                {/* Costos */}
                <td className="px-4 py-2 font-medium">
                  {formatMoney(p.subtotalBaseMXN)}
                </td>

                {/* Cotización -> botón Ver Cotización Viva */}
                <td className="px-4 py-2">
                  <Link
                    href={`/solicitudes/listado/${p.id}#cotizacion-viva`}
                    className="inline-flex items-center justify-center px-3 py-1 rounded bg-black text-white hover:opacity-90"
                    title="Ver Cotización Viva del pedido"
                  >
                    Ver Cotización
                  </Link>
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
                <td className="px-4 py-6 text-center text-gray-500" colSpan={8}>
                  No hay pedidos con fecha real en este proyecto.
                </td>
              </tr>
            )}
          </tbody>

          {pedidos.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 border-t">
                <td className="px-4 py-2 text-right font-semibold" colSpan={4}>
                  Total del proyecto:
                </td>
                <td className="px-4 py-2 font-bold">{formatMoney(totalProyectoMXN)}</td>
                <td className="px-4 py-2" colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* MODAL Compartir proyecto */}
      {abiertoCompartir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !guardandoShare && setAbiertoCompartir(false)}
          />
          <div className="relative bg-white text-black rounded-xl shadow-xl w-full max-w-2xl p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-base font-semibold">Compartir proyecto — {proyecto}</h2>
              <button
                className="text-gray-500 hover:text-gray-700 text-xl"
                onClick={() => !guardandoShare && setAbiertoCompartir(false)}
                title="Cerrar"
              >
                &times;
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-3">
              Selecciona los usuarios que podrán ver este proyecto y sus pedidos en <strong>Mis solicitudes</strong>, aunque ellos no hayan creado los pedidos.
            </p>

            <div className="mb-3">
              <input
                type="text"
                placeholder="Buscar por nombre o correo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>

            <div className="border rounded max-h-80 overflow-auto">
              {cargandoShare ? (
                <div className="p-4 text-sm text-gray-500">Cargando...</div>
              ) : filtrados.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">No hay usuarios que coincidan.</div>
              ) : (
                <ul className="divide-y">
                  {filtrados.map((u) => (
                    <li key={u.email} className="flex items-center justify-between px-3 py-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.nombre}</div>
                        <div className="text-xs text-gray-500 truncate">{u.email}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={seleccionados.has(u.email)}
                        onChange={() => toggleSeleccion(u.email)}
                        className="w-4 h-4"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                disabled={guardandoShare}
                onClick={() => setAbiertoCompartir(false)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                disabled={guardandoShare}
                onClick={guardarCompartir}
                className="px-3 py-1.5 rounded-lg bg-black text-white hover:opacity-90 text-sm disabled:opacity-60"
              >
                {guardandoShare ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>

            <div className="mt-2 text-xs text-gray-500">
              {seleccionados.size} usuario{seleccionados.size === 1 ? "" : "s"} seleccionado{seleccionados.size === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
