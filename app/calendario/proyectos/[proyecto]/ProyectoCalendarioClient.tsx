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
import { FiSearch, FiX } from "react-icons/fi";

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
  subtotalBaseMXN?: number;
};

type Usuario = {
  email: string;
  nombre: string;
  uid?: string;
};

const fmtMXN = (n: number) =>
  n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  });

// ---------- Status helpers (idénticos) ----------
const normStatus = (s: any) => String(s || "").trim().toLowerCase();

const statusPillClass = (status: any) => {
  const s = normStatus(status);

  const base =
    "px-3 py-1 rounded-full text-[11px] font-semibold border inline-flex items-center justify-center " +
    "leading-none whitespace-nowrap";

  if (s === "en proceso") {
    return (
      base +
      " bg-yellow-500/12 text-yellow-200 border-yellow-400/25 " +
      "shadow-[0_12px_30px_-24px_rgba(234,179,8,0.7)]"
    );
  }

  if (s === "listo") {
    return (
      base +
      " bg-emerald-500/12 text-emerald-200 border-emerald-400/25 " +
      "shadow-[0_12px_30px_-24px_rgba(16,185,129,0.75)]"
    );
  }

  if (s === "cancelado") {
    return (
      base +
      " bg-red-500/12 text-red-200 border-red-400/25 " +
      "shadow-[0_12px_30px_-24px_rgba(239,68,68,0.7)]"
    );
  }

  return base + " bg-white/5 text-white/75 border-white/12";
};

const statusLabel = (s: any) => {
  const v = String(s || "enviado");
  return v.replace(/\b\w/g, (c) => c.toUpperCase());
};

const actionBtnClass =
  "inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] " +
  "px-4 py-1.5 text-sm text-white/85 hover:bg-white/[0.10] hover:border-white/15 " +
  "transition shadow-[0_10px_30px_-20px_rgba(0,0,0,0.8)] whitespace-nowrap";

export default function ProyectoCalendarioClient({ proyecto }: { proyecto: string }) {
  const { isAdmin } = useAuth();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [nameByEmail, setNameByEmail] = useState<Record<string, string>>({});

  // --- Compartir proyecto ---
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [busquedaShare, setBusquedaShare] = useState("");
  const [abiertoCompartir, setAbiertoCompartir] = useState(false);
  const [guardandoShare, setGuardandoShare] = useState(false);
  const [cargandoShare, setCargandoShare] = useState(true);
  // --------------------------

  // Buscador tabla
  const [busqueda, setBusqueda] = useState("");

  // Paginación tipo Google
  const PAGE_SIZE = 7;
  const [page, setPage] = useState(1);

  const actualizarCampo = async (id: string, campo: string, valor: string) => {
    const refDoc = doc(db, "pedidos", id);
    await updateDoc(refDoc, { [campo]: valor });
    setPedidos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p))
    );
  };

  // (se mantiene aunque no lo uses aquí)
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
        const email = d.correoUsuario || "";

        basePedidos.push({
          id: docSnap.id,
          titulo: d.titulo || "Sin título",
          proyecto: d.proyecto || "Sin proyecto",
          fechaEntregaReal: d.fechaEntregaReal || "",
          fechaLimite: d.fechaLimite || "",
          status: d.status || "enviado",
          correoUsuario: email,
          nombreUsuario: map[email] || d.nombreUsuario || email || "",
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
          .sort((a, b) => {
            const da = new Date(a.fechaEntregaReal!);
            const dbb = new Date(b.fechaEntregaReal!);
            return dbb.getTime() - da.getTime();
          })
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

  const totalProyectoMXN = useMemo(
    () => pedidos.reduce((acc, p) => acc + (p.subtotalBaseMXN || 0), 0),
    [pedidos]
  );

  // ======= Buscador (igual idea que listado) =======
  const pedidosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return pedidos;

    return pedidos.filter((p) => {
      const titulo = String(p.titulo || "").toLowerCase();
      const id = String(p.id || "").toLowerCase();
      const solicitante = String(p.nombreUsuario || p.correoUsuario || "").toLowerCase();
      return titulo.includes(q) || id.includes(q) || solicitante.includes(q);
    });
  }, [pedidos, busqueda]);

  // cuando cambia búsqueda o proyecto: volver a página 1
  useEffect(() => {
    setPage(1);
  }, [busqueda, proyecto]);

  // ======= Paginación tipo Google =======
  const totalPages = Math.max(1, Math.ceil(pedidosFiltrados.length / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  const pedidosPaginados = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return pedidosFiltrados.slice(start, start + PAGE_SIZE);
  }, [pedidosFiltrados, pageSafe]);

  const getPageItems = (current: number, total: number) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const items: (number | "...")[] = [];
    const add = (x: number | "...") => items.push(x);

    add(1);

    const left = Math.max(2, current - 1);
    const right = Math.min(total - 1, current + 1);

    if (left > 2) add("...");

    for (let i = left; i <= right; i++) add(i);

    if (right < total - 1) add("...");

    add(total);
    return items;
  };

  const pageItems = useMemo(() => getPageItems(pageSafe, totalPages), [pageSafe, totalPages]);

  // ======= Sharing: filtro usuarios =======
  const usuariosFiltradosShare = useMemo(() => {
    const q = busquedaShare.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) => u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [usuarios, busquedaShare]);

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

  if (!isAdmin) {
    return (
      <div className="max-w-5xl mx-auto bg-white text-black p-6 rounded-xl shadow">
        <p>No autorizado.</p>
        <Link href="/calendario" className="text-blue-600 underline">
          Volver al calendario
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-8 py-10 text-white">
      {/* Back + header row */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/calendario"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10 transition"
        >
          ← Volver
        </Link>

        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight truncate">
          Pedidos fechados · <span className="text-white/80">{proyecto}</span>
        </h1>

        <button
          onClick={() => setAbiertoCompartir(true)}
          className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10 transition"
          title="Compartir este proyecto con usuarios específicos"
        >
          Compartir proyecto
        </button>
      </div>

      {/* Total gastado */}
      <div className="mt-4 text-sm text-white/70">
        <span className="font-semibold text-white/80">Total gastado (subtotal base):</span>{" "}
        {fmtMXN(totalProyectoMXN)}
      </div>

      {/* Toolbar (buscador) */}
      <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.05] backdrop-blur-2xl ring-1 ring-white/5 shadow-[0_20px_90px_-70px_rgba(0,0,0,0.95)] p-4 sm:p-5">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative w-full md:max-w-lg">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por título, solicitante o ID..."
              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] pl-10 pr-10 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
            />
            {busqueda.trim() !== "" && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                title="Limpiar búsqueda"
              >
                <FiX />
              </button>
            )}
          </div>

          <div className="text-sm text-white/60">
            Mostrando{" "}
            <span className="font-semibold text-white/80">{pedidosFiltrados.length}</span>{" "}
            pedidos
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mt-6">
        {pedidos.length === 0 ? (
          <p className="text-white/70">No hay pedidos con fecha real en este proyecto.</p>
        ) : pedidosFiltrados.length === 0 ? (
          <p className="text-white/70">No hay resultados para esa búsqueda.</p>
        ) : (
          <>
            {/* Card tabla con “elevation” + top glow */}
            <div className="relative rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-2xl ring-1 ring-white/5 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.95)] overflow-hidden">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-500/10 to-transparent" />

              <div className="w-full overflow-hidden">
                <table className="w-full table-fixed">
                  {/* ✅ Medidas tipo Listado, adaptadas a TUS 8 columnas */}
                  <colgroup>
                    <col className="w-[280px]" /> {/* Título */}
                    <col className="w-[120px]" /> {/* Solicitante */}
                    <col className="w-[130px]" /> {/* Fecha propuesta */}
                    <col className="w-[140px]" /> {/* Fecha real */}
                    <col className="w-[140px]" /> {/* Costos */}
                    <col className="w-[140px]" /> {/* Cotización */}
                    <col className="w-[120px]" /> {/* Status */}
                    <col className="w-[130px]" /> {/* Detalles */}
                  </colgroup>

                  <thead className="bg-white/[0.02]">
                    <tr className="text-left text-[12px] tracking-wide text-white/55">
                      <th className="py-3 px-4 font-semibold">Título</th>
                      <th className="py-3 px-4 font-semibold">Solicitante</th>
                      <th className="py-3 px-4 font-semibold">Entrega propuesta</th>
                      <th className="py-3 px-4 font-semibold">Entrega real</th>
                      <th className="py-3 px-4 font-semibold text-right">Costos (base)</th>
                      <th className="py-3 px-4 font-semibold">Cotización</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Detalles</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/8">
                    {pedidosPaginados.map((p) => (
                      <tr
                        key={p.id}
                        className="hover:bg-emerald-500/[0.04] transition align-top"
                      >
                        <td className="py-2.5 px-4">
                          <div
                            className="max-w-[280px] whitespace-normal break-words leading-snug text-white/90 font-medium"
                            title={p.titulo || ""}
                          >
                            {p.titulo || "Sin título"}
                          </div>
                          <div className="text-[10px] text-white/35 mt-1">
                            ID: <span className="break-all">{p.id}</span>
                          </div>
                        </td>

                        <td className="py-2.5 px-4 text-white/75">
                          {p.nombreUsuario || p.correoUsuario || "—"}
                        </td>

                        <td className="py-2.5 px-4 text-white/75">
                          {p.fechaLimite || "—"}
                        </td>

                        <td className="py-2.5 px-4">
                          <input
                            type="date"
                            value={p.fechaEntregaReal || ""}
                            onChange={(e) =>
                              actualizarCampo(p.id, "fechaEntregaReal", e.target.value)
                            }
                            className="w-[140px] rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                          />
                        </td>

                        <td className="py-2.5 px-4 text-white/80 text-right tabular-nums">
                          {Number(p.subtotalBaseMXN || 0) > 0
                            ? fmtMXN(Number(p.subtotalBaseMXN))
                            : "—"}
                        </td>

                        <td className="py-2.5 px-4">
                          <Link
                            href={`/solicitudes/listado/${p.id}#cotizacion-viva`}
                            className={actionBtnClass}
                            title="Ver Cotización Viva del pedido"
                          >
                            Ver cotización
                          </Link>
                        </td>

                        <td className="py-2.5 px-4">
                          <select
                            value={p.status || "enviado"}
                            onChange={(e) =>
                              actualizarCampo(p.id, "status", e.target.value)
                            }
                            className={statusPillClass(p.status || "enviado")}
                          >
                            <option value="enviado">Enviado</option>
                            <option value="visto">Visto</option>
                            <option value="en proceso">En proceso</option>
                            <option value="listo">Listo</option>
                            <option value="cancelado">Cancelado</option>
                          </select>
                        </td>

                        <td className="py-2.5 px-4">
                          <Link
                            href={`/solicitudes/listado/${p.id}`}
                            className={actionBtnClass}
                          >
                            Ver detalles
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer total + página */}
              <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] text-sm text-white/60">
                <div>
                  Página <span className="font-semibold text-white/80">{pageSafe}</span> de{" "}
                  <span className="font-semibold text-white/80">{totalPages}</span>
                </div>

                <div className="text-right">
                  <span className="font-semibold text-white/80">
                    Total gastado (subtotal base):
                  </span>
                  <span className="ml-2 text-white/80">{fmtMXN(totalProyectoMXN)}</span>
                </div>
              </div>
            </div>

            {/* Pager tipo Google */}
            {totalPages > 1 && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pageSafe === 1}
                  className={`rounded-xl border px-3 py-2 transition ${
                    pageSafe === 1
                      ? "border-white/10 bg-white/5 text-white/30 cursor-not-allowed"
                      : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                  }`}
                >
                  Anterior
                </button>

                {pageItems.map((it, idx) =>
                  it === "..." ? (
                    <span key={`dots-${idx}`} className="px-2 text-white/40">
                      …
                    </span>
                  ) : (
                    <button
                      key={it}
                      type="button"
                      onClick={() => setPage(it)}
                      className={`min-w-[40px] rounded-xl border px-3 py-2 transition ${
                        it === pageSafe
                          ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100 shadow-[0_12px_30px_-22px_rgba(16,185,129,0.9)]"
                          : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                      }`}
                    >
                      {it}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={pageSafe === totalPages}
                  className={`rounded-xl border px-3 py-2 transition ${
                    pageSafe === totalPages
                      ? "border-white/10 bg-white/5 text-white/30 cursor-not-allowed"
                      : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                  }`}
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL Compartir proyecto */}
      {abiertoCompartir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !guardandoShare && setAbiertoCompartir(false)}
          />
          <div className="relative rounded-3xl border border-white/10 bg-[#0b0b0f]/90 text-white backdrop-blur-2xl ring-1 ring-white/5 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.95)] w-full max-w-2xl p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-base font-semibold">
                Compartir proyecto — <span className="text-white/80">{proyecto}</span>
              </h2>
              <button
                className="text-white/60 hover:text-white text-xl"
                onClick={() => !guardandoShare && setAbiertoCompartir(false)}
                title="Cerrar"
              >
                &times;
              </button>
            </div>

            <p className="text-sm text-white/70 mb-3">
              Selecciona los usuarios que podrán ver este proyecto y sus pedidos en{" "}
              <strong className="text-white/85">Mis solicitudes</strong>, aunque ellos no hayan creado los pedidos.
            </p>

            <div className="mb-3">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o correo..."
                  value={busquedaShare}
                  onChange={(e) => setBusquedaShare(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] pl-10 pr-10 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                />
                {busquedaShare.trim() !== "" && (
                  <button
                    type="button"
                    onClick={() => setBusquedaShare("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                    title="Limpiar búsqueda"
                  >
                    <FiX />
                  </button>
                )}
              </div>
            </div>

            <div className="border border-white/10 rounded-2xl max-h-80 overflow-auto bg-white/[0.03]">
              {cargandoShare ? (
                <div className="p-4 text-sm text-white/60">Cargando...</div>
              ) : usuariosFiltradosShare.length === 0 ? (
                <div className="p-4 text-sm text-white/60">No hay usuarios que coincidan.</div>
              ) : (
                <ul className="divide-y divide-white/10">
                  {usuariosFiltradosShare.map((u) => (
                    <li key={u.email} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate text-white/90">{u.nombre}</div>
                        <div className="text-xs text-white/50 truncate">{u.email}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={seleccionados.has(u.email)}
                        onChange={() => toggleSeleccion(u.email)}
                        className="w-4 h-4 accent-emerald-400"
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
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                disabled={guardandoShare}
                onClick={guardarCompartir}
                className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/20 transition disabled:opacity-60 shadow-[0_12px_30px_-22px_rgba(16,185,129,0.9)]"
              >
                {guardandoShare ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>

            <div className="mt-2 text-xs text-white/45">
              {seleccionados.size} usuario{seleccionados.size === 1 ? "" : "s"} seleccionado
              {seleccionados.size === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
