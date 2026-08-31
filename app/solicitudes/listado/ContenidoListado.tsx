"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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
  const [esCompartidoConmigo, setEsCompartidoConmigo] = useState(false);
  const [nameByEmail, setNameByEmail] = useState<Record<string, string>>({});
  const [busqueda, setBusqueda] = useState("");

  const PAGE_SIZE = 7;
  const [page, setPage] = useState(1);

  const fmtMXN = (n: number) =>
    n.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    });

  const normStatus = (s: any) => String(s || "").trim().toLowerCase();

  const statusPillClass = (status: any) => {
    const s = normStatus(status);
    const base =
      "px-3 py-1.5 rounded-full text-[11px] font-semibold border inline-flex items-center justify-center leading-none whitespace-nowrap";

    if (s === "en proceso") {
      return `${base} bg-yellow-500/12 text-yellow-200 border-yellow-400/25 sm:shadow-[0_12px_30px_-24px_rgba(234,179,8,0.7)]`;
    }

    if (s === "listo") {
      return `${base} bg-emerald-500/12 text-emerald-200 border-emerald-400/25 sm:shadow-[0_12px_30px_-24px_rgba(16,185,129,0.75)]`;
    }

    if (s === "cancelado") {
      return `${base} bg-red-500/12 text-red-200 border-red-400/25 sm:shadow-[0_12px_30px_-24px_rgba(239,68,68,0.7)]`;
    }

    return `${base} bg-white/5 text-white/75 border-white/12`;
  };

  const statusLabel = (s: any) => {
    const v = String(s || "enviado");
    return v.replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const actionBtnClass =
    "inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white/85 hover:bg-white/[0.10] hover:border-white/15 transition sm:shadow-[0_10px_30px_-20px_rgba(0,0,0,0.8)] whitespace-nowrap";

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

  useEffect(() => {
    const cargarPedidos = async () => {
      if (!proyectoSeleccionado || !user?.email) return;
      const myEmail = String(user.email);

      let qBase;
      if (isAdmin || esCompartidoConmigo) {
        qBase = query(
          collection(db, "pedidos"),
          where("proyecto", "==", proyectoSeleccionado),
        );
      } else {
        qBase = query(
          collection(db, "pedidos"),
          where("proyecto", "==", proyectoSeleccionado),
          where("usuario", "==", myEmail),
        );
      }

      const querySnapshot = await getDocs(qBase);
      const listaBase = querySnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

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

      const listaConCostos = await Promise.all(
        listaBase.map(async (p: any) => {
          try {
            const linesRef = collection(
              db,
              "pedidos",
              p.id,
              "quote_live",
              "live",
              "lines",
            );
            const linesSnap = await getDocs(linesRef);
            let subtotalBase = 0;

            linesSnap.forEach((ln) => {
              const data = ln.data() as any;
              subtotalBase += Number(data?.subtotalMXN || 0);
            });

            return { ...p, costoBaseProyecto: subtotalBase };
          } catch (err) {
            console.warn(
              "No se pudieron leer líneas de cotización para",
              p.id,
              err,
            );
            return { ...p, costoBaseProyecto: 0 };
          }
        }),
      );

      setPedidos(listaConCostos);
    };

    cargarPedidos();
  }, [user, proyectoSeleccionado, isAdmin, esCompartidoConmigo]);

  const actualizarCampo = async (
    id: string,
    campo: string,
    valor: string,
  ) => {
    const pedidoAnterior = pedidos.find((pedido) => pedido.id === id);
    const valorAnterior = pedidoAnterior?.[campo] ?? "";

    setPedidos((prev) =>
      prev.map((pedido) =>
        pedido.id === id
          ? {
              ...pedido,
              [campo]: valor,
            }
          : pedido,
      ),
    );

    try {
      if (
        campo === "fechaEntregaReal" ||
        (campo === "status" && valor.trim().toLowerCase() === "listo")
      ) {
        if (!user) {
          throw new Error("No hay una sesión activa.");
        }

        const idToken = await user.getIdToken();
        const esFecha = campo === "fechaEntregaReal";
        const endpoint = esFecha
          ? "/api/monday/pedidos/fecha-entrega-real"
          : "/api/monday/pedidos/status";

        const body = esFecha
          ? {
              pedidoId: id,
              fechaEntregaReal: valor,
            }
          : {
              pedidoId: id,
              status: valor,
            };

        const response = await fetch(endpoint, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(body),
        });

        const result = await response.json().catch(() => null);

        if (!response.ok) {
          if (result?.savedInFirebase) {
            console.error(
              "Monday no se sincronizó completamente:",
              result?.details,
            );

            alert(
              result?.error ||
                "El cambio se guardó en Protolab, pero Monday no pudo sincronizarse completamente.",
            );
            return;
          }

          throw new Error(
            result?.error || "No se pudo actualizar el pedido.",
          );
        }

        return;
      }

      const refPedido = doc(db, "pedidos", id);
      await updateDoc(refPedido, {
        [campo]: valor,
      });
    } catch (error) {
      setPedidos((prev) =>
        prev.map((pedido) =>
          pedido.id === id
            ? {
                ...pedido,
                [campo]: valorAnterior,
              }
            : pedido,
        ),
      );

      console.error(`Error actualizando ${campo}:`, error);
      alert(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el pedido.",
      );
    }
  };

  const solicitanteDe = (p: any) => {
    const email = p?.correoUsuario || p?.usuario || "";
    return (
      p?.nombreUsuario ||
      (email ? nameByEmail[email] : "") ||
      email ||
      "-"
    );
  };

  const pedidosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return pedidos;

    return pedidos.filter((p: any) => {
      const titulo = String(p?.titulo || "").toLowerCase();
      const id = String(p?.id || "").toLowerCase();
      return titulo.includes(q) || id.includes(q);
    });
  }, [pedidos, busqueda]);

  useEffect(() => {
    setPage(1);
  }, [busqueda, proyectoSeleccionado]);

  const totalGastadoProyecto = useMemo(
    () =>
      pedidos.reduce(
        (acc, p: any) => acc + (Number(p?.costoBaseProyecto) || 0),
        0,
      ),
    [pedidos],
  );

  const totalPages = Math.max(
    1,
    Math.ceil(pedidosFiltrados.length / PAGE_SIZE),
  );
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

  const pageItems = useMemo(
    () => getPageItems(pageSafe, totalPages),
    [pageSafe, totalPages],
  );

  if (!user || !proyectoSeleccionado) return null;

  return (
    <Suspense
      fallback={
        <div className="text-center py-10 text-white/80">Cargando...</div>
      }
    >
      <div className="mx-auto max-w-7xl px-4 py-7 text-white sm:px-8 sm:py-10">
        <button
          onClick={() => router.push("/solicitudes")}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/90 transition hover:bg-white/10"
        >
          <FiArrowLeft /> Regresar
        </button>

        <div className="mt-5 sm:mt-6">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40 sm:hidden">
            Pedidos del proyecto
          </p>
          <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight sm:mt-0 sm:text-3xl">
            <span className="hidden sm:inline">Pedidos del proyecto · </span>
            <span className="text-white/85">{proyectoSeleccionado}</span>
          </h1>

          <div className="mt-2 text-sm text-white/70">
            <span className="font-semibold text-white/80">
              Total gastado (subtotal base):
            </span>{" "}
            <span className="tabular-nums">{fmtMXN(totalGastadoProyecto)}</span>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.05] p-3 backdrop-blur-sm ring-1 ring-white/5 sm:mt-6 sm:rounded-3xl sm:p-5 sm:backdrop-blur-2xl sm:shadow-[0_20px_90px_-70px_rgba(0,0,0,0.95)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-lg">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por título o ID..."
                className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.05] py-3 pl-10 pr-10 text-base text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-emerald-400/25 sm:rounded-2xl sm:text-sm"
              />
              {busqueda.trim() !== "" && (
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-white/60 hover:text-white"
                  title="Limpiar búsqueda"
                >
                  <FiX />
                </button>
              )}
            </div>

            <div className="text-sm text-white/60">
              Mostrando{" "}
              <span className="font-semibold text-white/80">
                {pedidosFiltrados.length}
              </span>{" "}
              pedidos
            </div>
          </div>
        </div>

        <div className="mt-5 sm:mt-6">
          {pedidos.length === 0 ? (
            <p className="text-white/70">
              No hay pedidos registrados para este proyecto.
            </p>
          ) : pedidosFiltrados.length === 0 ? (
            <p className="text-white/70">
              No hay resultados para esa búsqueda.
            </p>
          ) : (
            <>
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] backdrop-blur-sm ring-1 ring-white/5 sm:rounded-3xl sm:backdrop-blur-2xl sm:shadow-[0_30px_120px_-80px_rgba(0,0,0,0.95)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-emerald-500/10 to-transparent sm:h-24" />

                {/* Mobile */}
                <div className="relative space-y-3 p-3 sm:p-4 lg:hidden">
                  {pedidosPaginados.map((p) => (
                    <article
                      key={p.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h2 className="break-words text-base font-semibold leading-snug text-white/95">
                            {p.titulo || "Sin título"}
                          </h2>
                          <p className="mt-1 break-all text-[10px] text-white/35">
                            ID: {p.id}
                          </p>
                        </div>

                        {!isAdmin && (
                          <span className={statusPillClass(p.status || "enviado")}>
                            {statusLabel(p.status || "enviado")}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                        <div className="col-span-2">
                          <div className="text-[11px] uppercase tracking-wide text-white/40">
                            Solicitante
                          </div>
                          <div className="mt-1 break-words text-white/80">
                            {solicitanteDe(p)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-white/40">
                            Entrega propuesta
                          </div>
                          <div className="mt-1 text-white/80">
                            {p.fechaLimite || "—"}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-white/40">
                            Costos, base
                          </div>
                          <div className="mt-1 font-medium tabular-nums text-white/85">
                            {p.costoBaseProyecto > 0
                              ? fmtMXN(Number(p.costoBaseProyecto))
                              : "—"}
                          </div>
                        </div>

                        <div className="col-span-2">
                          <div className="text-[11px] uppercase tracking-wide text-white/40">
                            Entrega real
                          </div>
                          <div className="mt-1">
                            {isAdmin ? (
                              <input
                                type="date"
                                value={p.fechaEntregaReal || ""}
                                onChange={(e) =>
                                  actualizarCampo(
                                    p.id,
                                    "fechaEntregaReal",
                                    e.target.value,
                                  )
                                }
                                className="min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/25 [color-scheme:dark]"
                              />
                            ) : (
                              <span className="text-white/80">
                                {p.fechaEntregaReal || "Pendiente"}
                              </span>
                            )}
                          </div>
                        </div>

                        {isAdmin && (
                          <div className="col-span-2">
                            <div className="text-[11px] uppercase tracking-wide text-white/40">
                              Status
                            </div>
                            <select
                              value={p.status || "enviado"}
                              onChange={(e) =>
                                actualizarCampo(p.id, "status", e.target.value)
                              }
                              className={`${statusPillClass(
                                p.status || "enviado",
                              )} mt-2 min-h-11 w-full justify-center [&>option]:bg-white [&>option]:text-black`}
                            >
                              <option value="enviado">Enviado</option>
                              <option value="visto">Visto</option>
                              <option value="en proceso">En proceso</option>
                              <option value="listo">Listo</option>
                              <option value="cancelado">Cancelado</option>
                            </select>
                          </div>
                        )}
                      </div>

                      <Link
                        href={`/solicitudes/listado/${p.id}`}
                        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-100 transition active:bg-emerald-500/20"
                      >
                        Ver detalles
                      </Link>
                    </article>
                  ))}
                </div>

                {/* Desktop */}
                <div className="relative hidden w-full overflow-x-auto lg:block">
                  <table className="w-full min-w-[1210px] table-fixed">
                    <colgroup>
                      <col className="w-[300px]" />
                      <col className="w-[180px]" />
                      <col className="w-[170px]" />
                      <col className="w-[140px]" />
                      <col className="w-[170px]" />
                      <col className="w-[120px]" />
                      <col className="w-[130px]" />
                    </colgroup>

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

                    <tbody className="divide-y divide-white/10">
                      {pedidosPaginados.map((p) => (
                        <tr
                          key={p.id}
                          className="align-top transition hover:bg-emerald-500/[0.04]"
                        >
                          <td className="py-2.5 px-4">
                            <div
                              className="max-w-[280px] whitespace-normal break-words font-medium leading-snug text-white/90"
                              title={p.titulo || ""}
                            >
                              {p.titulo || "Sin título"}
                            </div>
                            <div className="mt-1 text-[10px] text-white/35">
                              ID: <span className="break-all">{p.id}</span>
                            </div>
                          </td>

                          <td className="py-2.5 px-4 text-white/75">
                            {solicitanteDe(p)}
                          </td>

                          <td className="py-2.5 px-4">
                            <Link
                              href={`/solicitudes/listado/${p.id}`}
                              className={actionBtnClass}
                            >
                              Ver detalles
                            </Link>
                          </td>

                          <td className="py-2.5 px-4 text-white/75">
                            {p.fechaLimite || "—"}
                          </td>

                          <td className="py-2.5 px-4">
                            {isAdmin ? (
                              <input
                                type="date"
                                value={p.fechaEntregaReal || ""}
                                onChange={(e) =>
                                  actualizarCampo(
                                    p.id,
                                    "fechaEntregaReal",
                                    e.target.value,
                                  )
                                }
                                className="w-[140px] rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/25 [color-scheme:dark]"
                              />
                            ) : (
                              <span className="text-white/75">
                                {p.fechaEntregaReal || "Pendiente"}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-4 text-right tabular-nums text-white/80">
                            {p.costoBaseProyecto > 0
                              ? fmtMXN(Number(p.costoBaseProyecto))
                              : "—"}
                          </td>

                          <td className="py-2.5 px-4">
                            {isAdmin ? (
                              <select
                                value={p.status || "enviado"}
                                onChange={(e) =>
                                  actualizarCampo(
                                    p.id,
                                    "status",
                                    e.target.value,
                                  )
                                }
                                className={`${statusPillClass(
                                  p.status || "enviado",
                                )} [&>option]:bg-white [&>option]:text-black`}
                              >
                                <option value="enviado">Enviado</option>
                                <option value="visto">Visto</option>
                                <option value="en proceso">En proceso</option>
                                <option value="listo">Listo</option>
                                <option value="cancelado">Cancelado</option>
                              </select>
                            ) : (
                              <span
                                className={statusPillClass(
                                  p.status || "enviado",
                                )}
                              >
                                {statusLabel(p.status || "enviado")}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="relative flex flex-col gap-2 border-t border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    Página{" "}
                    <span className="font-semibold text-white/80">
                      {pageSafe}
                    </span>{" "}
                    de{" "}
                    <span className="font-semibold text-white/80">
                      {totalPages}
                    </span>
                  </div>

                  <div className="sm:text-right">
                    <span className="font-semibold text-white/80">
                      Total gastado (subtotal base):
                    </span>
                    <span className="block tabular-nums text-white/80 sm:ml-2 sm:inline">
                      {fmtMXN(totalGastadoProyecto)}
                    </span>
                  </div>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pageSafe === 1}
                    className={`min-h-11 rounded-xl border px-3 py-2 transition ${
                      pageSafe === 1
                        ? "cursor-not-allowed border-white/10 bg-white/5 text-white/30"
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
                        className={`min-h-11 min-w-11 rounded-xl border px-3 py-2 transition ${
                          it === pageSafe
                            ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100 sm:shadow-[0_12px_30px_-22px_rgba(16,185,129,0.9)]"
                            : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                        }`}
                      >
                        {it}
                      </button>
                    ),
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={pageSafe === totalPages}
                    className={`min-h-11 rounded-xl border px-3 py-2 transition ${
                      pageSafe === totalPages
                        ? "cursor-not-allowed border-white/10 bg-white/5 text-white/30"
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
