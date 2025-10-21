"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getDownloadURL, ref, uploadBytes, deleteObject } from "firebase/storage";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db, storage } from "@/src/firebase/firebaseConfig";
import { useAuth } from "@/src/Context/AuthContext";
import { v4 as uuidv4 } from "uuid";

type Consumible = {
  titulo: string;      // Ej: "C1.Papel.Lija 400"
  imagenURL: string;
  lugar: string;
  cantidad: number;
  etiquetas?: string[]; // <-- NUEVO: etiquetas opcionales
};

type DocData = {
  items: Consumible[];
};

export default function ConsumiblesPage() {
  const { isAdmin } = useAuth();

  const [items, setItems] = useState<Consumible[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(""); // <-- NUEVO: búsqueda

  const docRef = doc(db, "inventario", "consumibles");

  const fetchData = async () => {
    setLoading(true);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, { items: [] } as DocData);
      setItems([]);
      setLoading(false);
      return;
    }
    const data = snap.data() as Partial<DocData>;
    const normalizados =
      (data.items || []).map((c) => ({
        ...c,
        etiquetas: Array.isArray(c.etiquetas) ? c.etiquetas : [],
      })) as Consumible[];
    setItems(normalizados);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  /* ---------- helpers ---------- */
  const normalize = (s: string) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

  const storagePathFromUrl = (url: string): string | null => {
    const match = decodeURIComponent(url).match(/\/o\/(.*?)\?alt/);
    return match?.[1]?.replace(/%2F/g, "/") ?? null;
  };

  // Agregar nuevo consumible (solo admin) — se deja igual
  const addItem = async (payload: { titulo: string; lugar: string; cantidad: number; imagen: File }) => {
    const id = uuidv4();
    const path = `inventario/consumibles/${id}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, payload.imagen);
    const imagenURL = await getDownloadURL(storageRef);

    const snap = await getDoc(docRef);
    if (!snap.exists()) await setDoc(docRef, { items: [] } as DocData);
    const current = (await getDoc(docRef)).data() as DocData;

    const nuevo: Consumible = {
      titulo: payload.titulo.trim(),
      lugar: payload.lugar.trim(),
      cantidad: payload.cantidad,
      imagenURL,
    };

    await updateDoc(docRef, { items: [...(current.items || []), nuevo] });
    await fetchData();
  };

  // Eliminar consumible por índice (solo admin)
  const deleteItem = async (index: number) => {
    if (!isAdmin) return;
    const current = (await getDoc(docRef)).data() as DocData;
    const item = current.items[index];
    if (!item) return;

    const path = storagePathFromUrl(item.imagenURL);
    if (path) {
      try {
        await deleteObject(ref(storage, path));
      } catch (e) {
        console.warn("No se pudo borrar imagen:", e);
      }
    }

    const nuevoArr = current.items.filter((_, i) => i !== index);
    await updateDoc(docRef, { items: nuevoArr });
    await fetchData();
  };

  // Actualizar cantidad inline (solo admin)
  const updateCantidad = async (index: number, nuevaCantidad: number) => {
    if (!isAdmin) return;
    const currentSnap = await getDoc(docRef);
    if (!currentSnap.exists()) return;
    const current = currentSnap.data() as DocData;

    const arr = [...(current.items || [])];
    if (!arr[index]) return;
    arr[index] = { ...arr[index], cantidad: nuevaCantidad };

    await updateDoc(docRef, { items: arr });
    setItems(
      arr.map((c) => ({ ...c, etiquetas: Array.isArray(c.etiquetas) ? c.etiquetas : [] }))
    ); // actualización optimista + normalización
  };

  // ---------- NUEVO: Filtrado por título o etiquetas ----------
  const filtered = useMemo(() => {
    const s = normalize(q.trim());
    if (!s) return items;
    return items.filter((it) => {
      const inTitle = normalize(it.titulo).includes(s);
      const inTags = (it.etiquetas || []).some((tg) => normalize(tg).includes(s));
      return inTitle || inTags;
    });
  }, [items, q]);

  const clearSearch = () => setQ("");

  return (
    <div className="max-w-7xl mx-auto bg-white text-black rounded-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Consumibles</h1>
        <button
          onClick={() => window.history.back()}
          className="bg-black text-white px-4 py-2 rounded hover:opacity-90"
        >
          ← Regresar
        </button>
      </div>

      <section className="border rounded-xl">
        <div className="w-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3">
          <span className="text-sm font-semibold">
            Listado {loading ? "" : `(${filtered.length})`}
          </span>

          {/* ---------- NUEVO: Buscador ---------- */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Buscar por título o etiqueta…"
              className="w-full sm:w-80 border rounded px-3 py-2 text-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                onClick={clearSearch}
                className="text-xs px-3 py-2 border rounded hover:bg-gray-50"
                title="Limpiar"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="px-4 pb-4">
          {loading ? (
            <p className="text-sm text-gray-600">Cargando…</p>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-gray-600 py-6">
              No se encontraron consumibles.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map((it, idx) => (
                <ConsumibleCard
                  key={idx}
                  item={it}
                  index={idx}
                  isAdmin={!!isAdmin}
                  onDelete={() => deleteItem(idx)}
                  onUpdateCantidad={updateCantidad}
                  onTagClick={(t) => setQ(t)} // <-- NUEVO: clic en chip filtra por etiqueta
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ------------------ Subcomponentes ------------------ */

function ConsumibleCard({
  item,
  index,
  isAdmin,
  onDelete,
  onUpdateCantidad,
  onTagClick,
}: {
  item: Consumible;
  index: number;
  isAdmin: boolean;
  onDelete: () => void;
  onUpdateCantidad: (index: number, nuevaCantidad: number) => Promise<void>;
  onTagClick: (tag: string) => void; // <-- NUEVO
}) {
  const [editingCantidad, setEditingCantidad] = useState(false);
  const [cantidadInput, setCantidadInput] = useState<string>(
    typeof item.cantidad === "number" ? String(item.cantidad) : ""
  );

  const handleSaveCantidad = async () => {
    const n = Number(cantidadInput);
    if (Number.isNaN(n) || n < 0) {
      alert("Cantidad inválida");
      return;
    }
    await onUpdateCantidad(index, n);
    setEditingCantidad(false);
  };

  // Contenido de la tarjeta
  const Inner = (
    <div className="relative bg-white text-black border rounded-xl overflow-hidden shadow-sm">
      {/* Título */}
      <div className="px-3 pt-2 pr-8">
        <h3 className="text-[13px] font-medium truncate" title={item.titulo}>
          {item.titulo}
        </h3>
      </div>

      {/* Imagen */}
      <div className="mt-2 h-28 w-full bg-gray-100">
        {item.imagenURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imagenURL}
            alt={item.titulo}
            className="h-full w-full object-cover"
            onError={(e) => ((e.currentTarget.style.display = "none"))}
          />
        ) : null}
      </div>

      {/* Lugar / Cantidad (edición solo admin) */}
      <div className="px-3 py-2 text-xs">
        <div>
          <span className="font-semibold">Lugar:</span>{" "}
          <span className="text-gray-700">{item.lugar || "—"}</span>
        </div>

        {!isAdmin || !editingCantidad ? (
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold">Cantidad:</span>{" "}
              <span className="text-gray-700">
                {typeof item.cantidad === "number" ? item.cantidad : "—"}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <input
              type="number"
              min={0}
              value={cantidadInput}
              onChange={(e) => setCantidadInput(e.target.value)}
              className="w-full border rounded px-2 py-1"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setEditingCantidad(false);
                  setCantidadInput(String(item.cantidad ?? ""));
                }}
                className="px-3 py-1 rounded border text-xs hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleSaveCantidad();
                }}
                className="px-3 py-1 rounded bg-black text-white text-xs hover:opacity-90"
              >
                Guardar
              </button>
            </div>
          </div>
        )}

        {/* ---------- NUEVO: Etiquetas como chips ---------- */}
        {(item.etiquetas && item.etiquetas.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.etiquetas.map((tag, i) => (
              <button
                key={`${tag}-${i}`}
                onClick={(e) => {
                  e.preventDefault();
                  onTagClick(tag);
                }}
                className="px-2 py-0.5 rounded-full bg-gray-200 hover:bg-gray-300 transition text-[11px]"
                title={`Buscar: ${tag}`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Admin: tarjeta es vínculo al flujo de retiro (se mantiene)
  if (isAdmin) {
    return (
      <Link href={`/inventario/consumibles/${index}/retirar`} className="block">
        {Inner}
      </Link>
    );
  }

  // Usuario normal: tarjeta informativa (no clicable)
  return <div>{Inner}</div>;
}
