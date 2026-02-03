"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getDocs,
  collection,
  query,
  where,
  updateDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../../src/firebase/firebaseConfig";
import { useAuth } from "../../../src/Context/AuthContext";
import Link from "next/link";
import { FiArrowLeft, FiSearch, FiX } from "react-icons/fi";

export default function ListadoPedidosPage() {
  const searchParams = useSearchParams();
  const proyectoSeleccionado = searchParams.get("proyecto");
  const { user, isAdmin } = useAuth();
  const router = useRouter();

  const [pedidos, setPedidos] = useState<any[]>([]);
  const [esCompartidoConmigo, setEsCompartidoConmigo] = useState<boolean>(false);
  const [nameByEmail, setNameByEmail] = useState<Record<string, string>>({});

  // Buscador
  const [busqueda, setBusqueda] = useState("");

  // Paginación
  const PAGE_SIZE = 7;
  const [page, setPage] = useState(1);

  const fmtMXN = (n: number) =>
    n.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    });

  // ---------- Status helpers ----------
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

  // Botón “glass” más elegante
  const actionBtnClass =
    "inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] " +
    "px-4 py-1.5 text-sm text-white/85 hover:bg-white/[0.10] hover:border-white/15 " +
    "transition shadow-[0_10px_30px_-20px_rgba(0,0,0,0.8)] whitespace-nowrap";

  // --- Cargar mapa de usuarios (email -> nombre completo) ---
  useEffect(() => {
    const cargarUsuarios = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const map: Record<string, string> = {};
        snap.forEach((docu) => {
          const u = docu.data() as any;
          if (u?.email) {
            const nombre =
              [u?.nombre, u?.apellido].filter(Boolean).join(" ") ||
              u?.displayName ||
              u.email;
            map[u.email] = nombre;
          }
        });
        setNameByEmail(map);
      } catch (e) {
        console.error("No se pudieron cargar usuarios:", e);
      }
    };
    cargarUsuarios();
  }, []);

  // 1) Revisar si el proyecto está compartido con el usuario actual
  useEffect(() => {
    const checarCompartido = async () => {
      if (!user?.email || !proyectoSeleccionado) return;
      const myEmail = String(user.email);

      try {
        const refShare = doc(db, "proyectos_shares", proyectoSeleccionado);
        const snapShare = await getDoc(refShare);
        if (snapShare.exists()) {
          const data = snapShare.data() as any;
          const arr: string[] = Array.isArray(data?.users) ? data.users : [];
          setEsCompartidoConmigo(arr.includes(myEmail));
        } else {
          setEsCompartidoConmigo(false);
        }
      } catch {
        setEsCompartidoConmigo(false);
      }
    };
    checarCompartido();
  }, [user, proyectoSeleccionado]);

  // 2) Cargar pedidos según permisos + traer costos (subtotal base) por pedido
  useEffect(() => {
    const cargarPedidos = async () => {
      if (!proyectoSeleccionado || !user?.email) return;
      const myEmail = String(user.email);

      let qBase;
      if (isAdmin || esCompartidoConmigo) {
        qBase = query(
          collection(db, "pedidos"),
          where("proyecto", "==", proyectoSeleccionado)
        );
      } else {
        qBase = query(
          collection(db, "pedidos"),
          where("proyecto", "==", proyectoSeleccionado),
          where("usuario", "==", myEmail)
        );
      }

      const querySnapshot = await getDocs(qBase);
      const listaBase = querySnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Orden: más nuevo primero.
      // 1) fechaEntregaReal (desc)  2) fechaLimite (desc)
      listaBase.sort((a: any, b: any) => {
        const aR = a?.fechaEntregaReal || "";
        const bR = b?.fechaEntregaReal || "";

        if (aR && bR) return bR.localeCompare(aR);
        if (aR) return -1;
        if (bR) return 1;

        const aP = a?.fechaLimite || "";
        const bP = b?.fechaLimite || "";
        return bP.localeCompare(aP);
      });

      // Para cada pedido: sumar subtotalMXN (base) de quote_live/live/lines
      const listaConCostos = await Promise.all(
        listaBase.map(async (p: any) => {
          try {
            const linesRef = collection(
              db,
              "pedidos",
              p.id,
              "quote_live",
              "live",
              "lines"
            );
            const linesSnap = await getDocs(linesRef);
            let subtotalBase = 0;
            linesSnap.forEach((ln) => {
              const data = ln.data() as any;
              subtotalBase += Number(data?.subtotalMXN || 0);
            });
            return { ...p, costoBaseProyecto: subtotalBase };
          } catch (err) {
            console.warn("No se pudieron leer líneas de cotización para", p.id, err);
            return { ...p, costoBaseProyecto: 0 };
          }
        })
      );

      setPedidos(listaConCostos);
    };

    cargarPedidos();
  }, [user, proyectoSeleccionado, isAdmin, esCompartidoConmigo]);

  const actualizarCampo = async (id: string, campo: string, valor: any) => {
    try {
      const refPedido = doc(db, "pedidos", id);
      await updateDoc(refPedido, { [campo]: valor });
      setPedidos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p))
      );
    } catch (err) {
      console.error("Error actualizando", campo, err);
    }
  };

  const solicitanteDe = (p: any) => {
    const email = p?.correoUsuario || p?.usuario || "";
    return p?.nombreUsuario || (email ? nameByEmail[email] : "") || email || "-";
  };

  // Filtrado buscador
  const pedidosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return pedidos;

    return pedidos.filter((p: any) => {
      const titulo = String(p?.titulo || "").toLowerCase();
      const id = String(p?.id || "").toLowerCase();
      return titulo.includes(q) || id.includes(q);
    });
  }, [pedidos, busqueda]);

  // Cuando cambia búsqueda, regresamos a página 1
  useEffect(() => {
    setPage(1);
  }, [busqueda, proyectoSeleccionado]);

  const totalGastadoProyecto = useMemo(
    () =>
      pedidos.reduce((acc, p: any) => acc + (Number(p?.costoBaseProyecto) || 0), 0),
    [pedidos]
  );

  // Paginación calculada
  const totalPages = Math.max(1, Math.ceil(pedidosFiltrados.length / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  const pedidosPaginados = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return pedidosFiltrados.slice(start, start + PAGE_SIZE);
  }, [pedidosFiltrados, pageSafe]);

  // Pager tipo Google (con elipsis)
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

  if (!user || !proyectoSeleccionado) return null;

  return (
    <Suspense fallback={<div className="text-center py-10 text-white/80">Cargando...</div>}>
      <div className="mx-auto max-w-7xl px-4 sm:px-8 py-10 text-white">
        {/* Back */}
        <button
          onClick={() => router.push("/solicitudes")}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10 transition"
        >
          <FiArrowLeft /> Regresar
        </button>

        {/* Header */}
        <div className="mt-6">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Pedidos del proyecto ·{" "}
            <span className="text-white/80">{proyectoSeleccionado}</span>
          </h1>

          <div className="mt-2 text-sm text-white/70">
            <span className="font-semibold text-white/80">
              Total gastado (subtotal base):
            </span>{" "}
            {fmtMXN(totalGastadoProyecto)}
          </div>
        </div>

        {/* Toolbar */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.05] backdrop-blur-2xl ring-1 ring-white/5 shadow-[0_20px_90px_-70px_rgba(0,0,0,0.95)] p-4 sm:p-5">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="relative w-full md:max-w-lg">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por título..."
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
            <p className="text-white/70">No hay pedidos registrados para este proyecto.</p>
          ) : pedidosFiltrados.length === 0 ? (
            <p className="text-white/70">No hay resultados para esa búsqueda.</p>
          ) : (
            <>
              {/* ✅ Card tabla con más “elevation” + top glow */}
              <div className="relative rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-2xl ring-1 ring-white/5 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.95)] overflow-hidden">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-500/10 to-transparent" />

                <div className="w-full overflow-hidden">
                  <table className="w-full table-fixed">
                    {/* ✅ IMPORTANTE: colgroup sin whitespace/hydration issues */}
                    <colgroup>
                      <col className="w-[300px]" />
                      <col className="w-[180px]" />
                      <col className="w-[170px]" />
                      <col className="w-[140px]" />
                      <col className="w-[170px]" />
                      <col className="w-[120px]" />
                      <col className="w-[130px]" />
                    </colgroup>

                    {/* ✅ Header más fino y elegante */}
                    <thead className="bg-white/[0.02]">
                      <tr className="text-left text-[12px] tracking-wide text-white/55">
                        <th className="py-3 px-4 font-semibold">Título</th>
                        <th className="py-3 px-4 font-semibold">Solicitante</th>
                        <th className="py-3 px-4 font-semibold">Detalles</th>
                        <th className="py-3 px-4 font-semibold">Entrega propuesta</th>
                        <th className="py-3 px-4 font-semibold">Entrega real</th>
                        <th className="py-3 px-4 font-semibold text-right">Costos (base)</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                      </tr>
                    </thead>

                    {/* ✅ Divisores más sutiles */}
                    <tbody className="divide-y divide-white/8">
                      {pedidosPaginados.map((p) => (
                        <tr
                          key={p.id}
                          className="hover:bg-emerald-500/[0.04] transition align-top"
                        >
                          {/* ✅ Título compacto + wrap a 2–3 líneas */}
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

                          <td className="py-2.5 px-4 text-white/75">{solicitanteDe(p)}</td>

                          <td className="py-2.5 px-4">
                            <Link href={`/solicitudes/listado/${p.id}`} className={actionBtnClass}>
                              Ver detalles
                            </Link>
                          </td>

                          <td className="py-2.5 px-4 text-white/75">{p.fechaLimite || "—"}</td>

                          <td className="py-2.5 px-4">
                            {isAdmin ? (
                              <input
                                type="date"
                                value={p.fechaEntregaReal || ""}
                                onChange={(e) =>
                                  actualizarCampo(p.id, "fechaEntregaReal", e.target.value)
                                }
                                className="w-[140px] rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                              />
                            ) : (
                              <span className="text-white/75">
                                {p.fechaEntregaReal || "Pendiente"}
                              </span>
                            )}
                          </td>

                          {/* ✅ Costos alineados a la derecha para orden visual */}
                          <td className="py-2.5 px-4 text-white/80 text-right tabular-nums">
                            {p.costoBaseProyecto > 0 ? fmtMXN(Number(p.costoBaseProyecto)) : "—"}
                          </td>

                          <td className="py-2.5 px-4">
                            {isAdmin ? (
                              <select
                                value={p.status || "enviado"}
                                onChange={(e) => actualizarCampo(p.id, "status", e.target.value)}
                                className={statusPillClass(p.status || "enviado")}
                              >
                                <option value="enviado">Enviado</option>
                                <option value="visto">Visto</option>
                                <option value="en proceso">En proceso</option>
                                <option value="listo">Listo</option>
                                <option value="cancelado">Cancelado</option>
                              </select>
                            ) : (
                              <span className={statusPillClass(p.status || "enviado")}>
                                {statusLabel(p.status || "enviado")}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer total */}
                <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] text-sm text-white/60">
                  <div>
                    Página <span className="font-semibold text-white/80">{pageSafe}</span> de{" "}
                    <span className="font-semibold text-white/80">{totalPages}</span>
                  </div>

                  <div className="text-right">
                    <span className="font-semibold text-white/80">
                      Total gastado (subtotal base):
                    </span>
                    <span className="ml-2 text-white/80">{fmtMXN(totalGastadoProyecto)}</span>
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
      </div>
    </Suspense>
  );
}
