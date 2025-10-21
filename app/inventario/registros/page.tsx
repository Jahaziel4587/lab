"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/src/firebase/firebaseConfig";
import { useAuth } from "@/src/Context/AuthContext";

/* ---------- Tipos ---------- */
type Consumible = {
  titulo: string;
  imagenURL: string;
  lugar: string;
  cantidad: number;
  etiquetas?: string[]; // <-- NUEVO: etiquetas
};

type DocConsumibles = {
  items: Consumible[];
};

type Movement = {
  consumibleTitulo: string;
  consumibleIndex?: number;
  proyecto: string;
  userId: string;
  userName: string;
  cantidadTomada: number;
  fecha?: any; // Firestore Timestamp | string | Date
};

type PerfilUsuario = {
  uid: string;
  nombre?: string;
  apellido?: string;
  displayName?: string;
  role?: string;
  codigoVerificacion?: string | null;
};

/* ---------- Util ---------- */
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

/* =========================================================
   PAGE
   ========================================================= */
export default function RegistrosInventarioPage() {
  const { isAdmin } = useAuth();

  /* ----- Estado: captura de consumible ----- */
  const [titulo, setTitulo] = useState("");
  const [lugar, setLugar] = useState("");
  const [cantidadStr, setCantidadStr] = useState("");
  const [archivoImg, setArchivoImg] = useState<File | null>(null);
  const [etiquetasStr, setEtiquetasStr] = useState(""); // <-- NUEVO: input de etiquetas (coma-separadas)
  const [guardando, setGuardando] = useState(false);

  /* ----- Estado: listado de consumibles ----- */
  const [consumibles, setConsumibles] = useState<Consumible[]>([]);
  const [loadingConsumibles, setLoadingConsumibles] = useState(true);

  /* ----- Edición de cantidad en tabla de consumibles ----- */
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editCantidad, setEditCantidad] = useState<string>("");
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingCantidad, setPendingCantidad] = useState<number | null>(null);

  /* ----- NUEVO: Edición de etiquetas ----- */
  const [editTagsIndex, setEditTagsIndex] = useState<number | null>(null);
  const [editTagsStr, setEditTagsStr] = useState<string>("");

  /* ----- Estado: movimientos (tu tabla actual) ----- */
  const [movs, setMovs] = useState<Movement[]>([]);
  const [loadingMovs, setLoadingMovs] = useState(true);
  const [search, setSearch] = useState("");

  /* ---------- Listeners ---------- */
  useEffect(() => {
    if (!isAdmin) return;

    // a) Escuchar consumibles (documento único)
    const refDoc = doc(db, "inventario", "consumibles");
    const unsubConsumibles = onSnapshot(refDoc, (snap) => {
      const data = (snap.data() as DocConsumibles) || { items: [] };
      // Asegurar que siempre exista el arreglo de etiquetas para evitar undefined
      const normalizados = (data.items || []).map((c) => ({
        ...c,
        etiquetas: Array.isArray(c.etiquetas) ? c.etiquetas : [],
      }));
      setConsumibles(normalizados);
      setLoadingConsumibles(false);
    });

    // b) Escuchar movimientos (como ya tenías)
    const qMovs = query(collection(db, "inventory_movements"), orderBy("fecha", "desc"));
    const unsubMovs = onSnapshot(qMovs, (snap) => {
      const data = snap.docs.map((d) => d.data() as Movement);
      setMovs(data);
      setLoadingMovs(false);
    });

    return () => {
      unsubConsumibles();
      unsubMovs();
    };
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return movs;
    return movs.filter((m) => {
      const texto = `${m.consumibleTitulo ?? ""} ${m.proyecto ?? ""} ${m.userName ?? ""}`.toLowerCase();
      return texto.includes(s);
    });
  }, [movs, search]);

  /* ---------- Acciones: alta de consumibles ---------- */
  const resetForm = () => {
    setTitulo("");
    setLugar("");
    setCantidadStr("");
    setArchivoImg(null);
    setEtiquetasStr(""); // <-- NUEVO
  };

  // util para parsear/limpiar etiquetas
  const parseEtiquetas = (raw: string): string[] => {
    // soporta separar por comas y/o saltos de línea
    const arr = raw
      .split(/[,;\n]/g)
      .map((t) => t.trim())
      .filter(Boolean);
    // quitar duplicados manteniendo orden
    const seen = new Set<string>();
    const clean: string[] = [];
    for (const tag of arr) {
      const key = tag; // puedes normalizar a lower: tag.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key);
        clean.push(tag);
      }
    }
    return clean;
  };

  const handleGuardarConsumible = async () => {
    if (!isAdmin) {
      alert("No tienes permisos para registrar consumibles.");
      return;
    }
    if (!titulo.trim() || !cantidadStr.trim()) {
      alert("Completa al menos Título y Cantidad.");
      return;
    }
    const cantidad = Number(cantidadStr);
    if (Number.isNaN(cantidad) || cantidad < 0) {
      alert("Cantidad inválida.");
      return;
    }

    const etiquetas = parseEtiquetas(etiquetasStr); // <-- NUEVO

    setGuardando(true);
    try {
      // Asegurar doc
      const refDoc = doc(db, "inventario", "consumibles");
      const snap = await getDoc(refDoc);
      if (!snap.exists()) {
        await setDoc(refDoc, { items: [] } as DocConsumibles);
      }
      const actual = (await getDoc(refDoc)).data() as DocConsumibles;

      // Subir imagen si viene
      let imagenURL = "";
      if (archivoImg) {
        const path = `inventario/consumibles/${Date.now()}_${archivoImg.name}`;
        const sref = ref(storage, path);
        await uploadBytes(sref, archivoImg);
        imagenURL = await getDownloadURL(sref);
      }

      const nuevo: Consumible = {
        titulo: titulo.trim(),
        lugar: lugar.trim(),
        cantidad,
        imagenURL,
        etiquetas, // <-- NUEVO
      };

      await updateDoc(refDoc, { items: [...(actual.items || []), nuevo] });

      resetForm();
      alert("Consumible registrado.");
    } catch (e) {
      console.error(e);
      alert("No se pudo registrar el consumible.");
    } finally {
      setGuardando(false);
    }
  };

  /* ---------- Acciones: edición de cantidad ---------- */
  const startEdit = (i: number) => {
    setEditIndex(i);
    setEditCantidad(String(consumibles[i]?.cantidad ?? ""));
  };

  const cancelEdit = () => {
    setEditIndex(null);
    setEditCantidad("");
  };

  const requestSaveCantidad = () => {
    const n = Number(editCantidad);
    if (Number.isNaN(n) || n < 0) {
      alert("Cantidad inválida.");
      return;
    }
    setPendingCantidad(n);
    setAuthOpen(true); // abrir modal de autenticación admin
  };

  const persistCantidad = async (index: number, nueva: number) => {
    const refDoc = doc(db, "inventario", "consumibles");
    const snap = await getDoc(refDoc);
    if (!snap.exists()) return;
    const data = snap.data() as DocConsumibles;
    const arr = [...(data.items || [])];
    if (!arr[index]) return;
    arr[index] = { ...arr[index], cantidad: nueva };
    await updateDoc(refDoc, { items: arr });
  };

  /* ---------- NUEVO: Acciones edición de etiquetas ---------- */
  const startEditTags = (i: number) => {
    const current = consumibles[i];
    const tags = (current?.etiquetas || []).join(", ");
    setEditTagsIndex(i);
    setEditTagsStr(tags);
  };

  const cancelEditTags = () => {
    setEditTagsIndex(null);
    setEditTagsStr("");
  };

  const persistEtiquetas = async (index: number, nuevasStr: string) => {
    const refDoc = doc(db, "inventario", "consumibles");
    const snap = await getDoc(refDoc);
    if (!snap.exists()) return;
    const data = snap.data() as DocConsumibles;
    const arr = [...(data.items || [])];
    if (!arr[index]) return;

    const nuevas = parseEtiquetas(nuevasStr);
    arr[index] = { ...arr[index], etiquetas: nuevas };
    await updateDoc(refDoc, { items: arr });
  };

  /* ---------- Guardas si no es admin ---------- */
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

  /* ---------- Vista admin ---------- */
  return (
    <div className="min-h-screen px-6 py-10 bg-gray-600">
      <div className="max-w-7xl mx-auto bg-white text-black rounded-2xl p-6 space-y-8">
        {/* Encabezado */}
        <div className="mb-2 flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold">Registros de inventario</h1>
          <button
            onClick={() => window.history.back()}
            className="bg-black text-white px-4 py-2 rounded hover:opacity-90"
          >
            ← Regresar
          </button>
        </div>

        {/* =========================================================
            A) Captura de consumibles (tabla simple)
           ========================================================= */}
        <section className="border rounded-xl overflow-auto">
          <div className="px-4 py-3 border-b bg-gray-50">
            <span className="text-sm font-semibold">Registro de consumibles</span>
          </div>

          <div className="p-4">
            <div className="overflow-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Título</th>
                    <th className="text-left px-3 py-2 font-semibold">Lugar</th>
                    <th className="text-right px-3 py-2 font-semibold">Cantidad</th>
                    <th className="text-left px-3 py-2 font-semibold">Imagen</th>
                    <th className="text-left px-3 py-2 font-semibold">Etiquetas</th>{/* NUEVO */}
                    <th className="text-left px-3 py-2 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        className="w-full border rounded px-2 py-1"
                        placeholder='Ej. "C1.Papel Lija 400"'
                        value={titulo}
                        onChange={(e) => setTitulo(e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        className="w-full border rounded px-2 py-1"
                        placeholder="Ej. Gaveta A-1"
                        value={lugar}
                        onChange={(e) => setLugar(e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        className="w-full border rounded px-2 py-1 text-right"
                        placeholder="0"
                        value={cantidadStr}
                        onChange={(e) => setCantidadStr(e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setArchivoImg(e.target.files?.[0] || null)}
                        className="w-full"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        className="w-full border rounded px-2 py-1"
                        placeholder='Ej. "abrasivos, lija, 400"'
                        value={etiquetasStr}
                        onChange={(e) => setEtiquetasStr(e.target.value)}
                      />
                      <p className="text-[11px] text-gray-500 mt-1">
                        Separa por comas (ej. <code>abrasivos, lija, 400</code>)
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={handleGuardarConsumible}
                        disabled={guardando}
                        className="px-3 py-2 rounded bg-black text-white text-xs hover:opacity-90 disabled:opacity-50"
                      >
                        {guardando ? "Guardando…" : "Guardar"}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-2 text-xs text-gray-500">
              * Se guarda en <code>inventario/consumibles</code> → <code>items[]</code>.
            </p>
          </div>
        </section>

        {/* =========================================================
            B) Tabla desplegable con consumibles (editable en cantidad + NUEVO: etiquetas)
           ========================================================= */}
        <section className="border rounded-xl">
          <details open className="w-full">
            <summary className="cursor-pointer px-4 py-3 bg-gray-50 border-b text-sm font-semibold">
              Consumibles cargados {loadingConsumibles ? "(cargando…)" : `(${consumibles.length})`}
            </summary>

            <div className="p-4 overflow-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">#</th>
                    <th className="text-left px-3 py-2 font-semibold">Título</th>
                    <th className="text-left px-3 py-2 font-semibold">Lugar</th>
                    <th className="text-right px-3 py-2 font-semibold">Cantidad</th>
                    <th className="text-left px-3 py-2 font-semibold">Imagen</th>
                    <th className="text-left px-3 py-2 font-semibold">Etiquetas</th>{/* NUEVO */}
                    <th className="text-left px-3 py-2 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {consumibles.map((c, i) => {
                    const isEditing = editIndex === i;
                    const isEditingTags = editTagsIndex === i; // NUEVO
                    return (
                      <tr key={i} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2">{i + 1}</td>
                        <td className="px-3 py-2">{c.titulo || "—"}</td>
                        <td className="px-3 py-2">{c.lugar || "—"}</td>

                        {/* Cantidad (editable) */}
                        <td className="px-3 py-2 text-right">
                          {!isEditing ? (
                            <span>{c.cantidad ?? "—"}</span>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              className="w-24 border rounded px-2 py-1 text-right"
                              value={editCantidad}
                              onChange={(e) => setEditCantidad(e.target.value)}
                            />
                          )}
                        </td>

                        {/* Imagen */}
                        <td className="px-3 py-2">
                          {c.imagenURL ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.imagenURL}
                              alt={c.titulo}
                              className="h-12 w-12 object-cover rounded border"
                              onError={(e) => ((e.currentTarget.style.display = "none"))}
                            />
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* NUEVO: Etiquetas (editable independiente) */}
                        <td className="px-3 py-2">
                          {!isEditingTags ? (
                            <div className="flex flex-wrap gap-1 items-center">
                              {(c.etiquetas && c.etiquetas.length > 0) ? (
                                c.etiquetas.map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 text-xs rounded-full bg-gray-200"
                                  >
                                    {tag}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                              <button
                                onClick={() => startEditTags(i)}
                                className="ml-2 px-2 py-1 rounded border text-[11px] hover:bg-gray-50"
                              >
                                Editar
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <input
                                type="text"
                                className="w-full border rounded px-2 py-1"
                                value={editTagsStr}
                                onChange={(e) => setEditTagsStr(e.target.value)}
                                placeholder='Ej. "abrasivos, lija, 400"'
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={cancelEditTags}
                                  className="px-3 py-1 rounded border text-xs hover:bg-gray-50"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      await persistEtiquetas(i, editTagsStr);
                                      setEditTagsIndex(null);
                                      setEditTagsStr("");
                                      alert("Etiquetas actualizadas.");
                                    } catch (e) {
                                      console.error(e);
                                      alert("No se pudieron actualizar las etiquetas.");
                                    }
                                  }}
                                  className="px-3 py-1 rounded bg-black text-white text-xs hover:opacity-90"
                                >
                                  Guardar
                                </button>
                              </div>
                              <p className="text-[11px] text-gray-500">
                                Separa por comas (ej. <code>abrasivos, lija, 400</code>)
                              </p>
                            </div>
                          )}
                        </td>

                        {/* Acciones (iguales para cantidad) */}
                        <td className="px-3 py-2">
                          {!isEditing ? (
                            <button
                              onClick={() => startEdit(i)}
                              className="px-3 py-1 rounded border text-xs hover:bg-gray-50"
                            >
                              Editar
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={cancelEdit}
                                className="px-3 py-1 rounded border text-xs hover:bg-gray-50"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={requestSaveCantidad}
                                className="px-3 py-1 rounded bg-black text-white text-xs hover:opacity-90"
                              >
                                Guardar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {!loadingConsumibles && consumibles.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-gray-500 text-sm">
                        No hay consumibles registrados aún.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        {/* =========================================================
            C) Registros de movimientos (tu tabla original)
           ========================================================= */}
        <section className="border rounded-xl">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between gap-4">
            <span className="text-sm font-semibold">Registros de movimientos</span>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Buscar por consumible, proyecto o usuario…"
                className="w-full max-w-md border rounded px-3 py-2 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="text-xs text-gray-600">
                {loadingMovs ? "Cargando…" : `${filtered.length} registro(s)`}
              </div>
            </div>
          </div>

          <div className="overflow-auto">
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

                {!loadingMovs && filtered.length === 0 && (
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
        </section>
      </div>

      {/* Modal de autenticación admin para confirmar cambio de cantidad */}
      {authOpen && editIndex != null && (
        <AdminAuthModal
          onClose={() => {
            setAuthOpen(false);
            setPendingCantidad(null);
          }}
          onSuccess={async (adminConfirmado) => {
            try {
              if (pendingCantidad == null) return;
              await persistCantidad(editIndex, pendingCantidad);
              setAuthOpen(false);
              setPendingCantidad(null);
              setEditIndex(null);
              setEditCantidad("");
              alert("Cantidad actualizada.");
            } catch (e) {
              console.error(e);
              alert("No se pudo actualizar la cantidad.");
            }
          }}
        />
      )}
    </div>
  );
}

/* =========================================================
   Modal simple de autenticación admin (selección + PIN)
   - Crea PIN si no existe
   - Valida PIN de 3 dígitos
   ========================================================= */
function AdminAuthModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (admin: PerfilUsuario) => void;
}) {
  const [admins, setAdmins] = useState<PerfilUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminSel, setAdminSel] = useState<PerfilUsuario | null>(null);
  const [pin, setPin] = useState("");
  const [pinNuevo, setPinNuevo] = useState("");
  const [pinNuevo2, setPinNuevo2] = useState("");

  const creandoPin = adminSel && !adminSel.codigoVerificacion;

  useEffect(() => {
    const loadAdmins = async () => {
      try {
        const qAdmins = query(collection(db, "users"), where("role", "==", "admin"));
        const snap = await getDocs(qAdmins);
        const list = snap.docs
          .map((d) => {
            const raw = d.data() as any;
            const display =
              (raw.displayName as string) ||
              [raw?.nombre, raw?.apellido].filter(Boolean).join(" ") ||
              "Admin";
            return {
              uid: d.id,
              nombre: raw?.nombre,
              apellido: raw?.apellido,
              displayName: display,
              role: raw?.role,
              codigoVerificacion: raw?.codigoVerificacion ?? null,
            } as PerfilUsuario;
          })
          .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
        setAdmins(list);
      } catch (e) {
        console.error(e);
        alert("No se pudieron cargar administradores.");
      } finally {
        setLoading(false);
      }
    };
    loadAdmins();
  }, []);

  const nombreAdmin = useMemo(() => {
    if (!adminSel) return "";
    return (
      adminSel.displayName ||
      [adminSel.nombre, adminSel.apellido].filter(Boolean).join(" ") ||
      "Admin"
    );
  }, [adminSel]);

  const resetPins = () => {
    setPin("");
    setPinNuevo("");
    setPinNuevo2("");
  };

  const handleConfirm = async () => {
    if (!adminSel) {
      alert("Selecciona un administrador.");
      return;
    }

    if (creandoPin) {
      if (pinNuevo.length !== 3 || pinNuevo2.length !== 3) {
        alert("El PIN debe tener 3 dígitos.");
        return;
      }
      if (pinNuevo !== pinNuevo2) {
        alert("Los PIN no coinciden.");
        resetPins();
        return;
      }
      try {
        await updateDoc(doc(db, "users", adminSel.uid), { codigoVerificacion: pinNuevo });
        const actualizado = { ...adminSel, codigoVerificacion: pinNuevo };
        setAdminSel(actualizado);
        resetPins();
        alert("PIN creado. Vuelve a ingresar para confirmar.");
        return;
      } catch (e) {
        console.error(e);
        alert("No se pudo guardar el PIN.");
        return;
      }
    } else {
      if ((adminSel.codigoVerificacion || "") !== pin) {
        alert("PIN incorrecto.");
        setPin("");
        return;
      }
      onSuccess(adminSel);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white text-black rounded-2xl w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Confirmar cambio de cantidad</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border flex items-center justify-center"
            title="Cerrar"
          >
            ×
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-600">Cargando administradores…</p>
        ) : (
          <>
            {/* Selección de admin */}
            <div>
              <p className="text-sm text-gray-700 mb-2">
                Selecciona el administrador que autoriza el cambio:
              </p>
              <div className="flex flex-wrap gap-3 mb-4">
                {admins.map((a) => {
                  const nombre =
                    a.displayName || [a.nombre, a.apellido].filter(Boolean).join(" ") || "Admin";
                  const active = adminSel?.uid === a.uid;
                  return (
                    <button
                      key={a.uid}
                      onClick={() => {
                        setAdminSel(a);
                        resetPins();
                      }}
                      className={`px-3 py-2 rounded border text-xs ${active ? "bg-black text-white" : "bg-white text-black"}`}
                      title={nombre}
                    >
                      {nombre}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PIN */}
            {adminSel && (
              <div className="mt-2 space-y-2">
                {!creandoPin ? (
                  <>
                    <label className="text-sm font-medium">
                      PIN de {nombreAdmin} (3 dígitos)
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="\d{3}"
                      maxLength={3}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 3))}
                      className="w-24 border rounded px-3 py-2 tracking-widest text-center"
                      placeholder="•••"
                    />
                  </>
                ) : (
                  <>
                    <label className="text-sm font-medium">Crear PIN (3 dígitos)</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        inputMode="numeric"
                        pattern="\d{3}"
                        maxLength={3}
                        value={pinNuevo}
                        onChange={(e) => setPinNuevo(e.target.value.replace(/\D/g, "").slice(0, 3))}
                        className="w-24 border rounded px-3 py-2 tracking-widest text-center"
                        placeholder="•••"
                      />
                      <input
                        type="password"
                        inputMode="numeric"
                        pattern="\d{3}"
                        maxLength={3}
                        value={pinNuevo2}
                        onChange={(e) => setPinNuevo2(e.target.value.replace(/\D/g, "").slice(0, 3))}
                        className="w-24 border rounded px-3 py-2 tracking-widest text-center"
                        placeholder="•••"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded border hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 rounded bg-black text-white hover:opacity-90"
              >
                Confirmar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
