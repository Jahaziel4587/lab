"use client";
import { useEffect, useState } from "react";
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
};

type DocData = {
  items: Consumible[];
};

export default function ConsumiblesPage() {
  const { isAdmin } = useAuth();

  const [items, setItems] = useState<Consumible[]>([]);
  const [loading, setLoading] = useState(true);

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
    setItems(data.items || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  /* ---------- helpers ---------- */

  const storagePathFromUrl = (url: string): string | null => {
    const match = decodeURIComponent(url).match(/\/o\/(.*?)\?alt/);
    return match?.[1]?.replace(/%2F/g, "/") ?? null;
  };

  // Agregar nuevo consumible (solo admin)
  const addItem = async (payload: { titulo: string; lugar: string; cantidad: number; imagen: File }) => {
    // 1) sube imagen
    const id = uuidv4();
    const path = `inventario/consumibles/${id}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, payload.imagen);
    const imagenURL = await getDownloadURL(storageRef);

    // 2) actualiza doc
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

    // borra imagen best-effort
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
    setItems(arr); // actualización optimista
  };

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
          <div className="w-full flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold">Listado</span>
          </div>

          <div className="px-4 pb-4">
            {loading ? (
              <p className="text-sm text-gray-600">Cargando…</p>
            ) : items.length === 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {isAdmin && <AddCard onSave={addItem} />}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {items.map((it, idx) => (
                  <ConsumibleCard
                    key={idx}
                    item={it}
                    index={idx}
                    isAdmin={!!isAdmin}
                    onDelete={() => deleteItem(idx)}
                    onUpdateCantidad={updateCantidad}
                  />
                ))}

                {isAdmin && <AddCard onSave={addItem} />}
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
}: {
  item: Consumible;
  index: number;
  isAdmin: boolean;
  onDelete: () => void;
  onUpdateCantidad: (index: number, nuevaCantidad: number) => Promise<void>;
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
      {/* Botón borrar (solo admin) */}
      {isAdmin && (
        <button
          onClick={(e) => {
            e.preventDefault(); // en caso de estar dentro de Link
            if (confirm("¿Eliminar este consumible?")) onDelete();
          }}
          className="absolute right-2 top-2 w-6 h-6 rounded-full bg-white border text-gray-700 hover:bg-gray-100 text-xs z-10"
          title="Eliminar"
        >
          ×
        </button>
      )}

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
            {isAdmin && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setEditingCantidad(true);
                }}
                className="text-blue-600 hover:underline"
              >
                Editar
              </button>
            )}
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
      </div>
    </div>
  );

  // Admin: tarjeta es vínculo al flujo de retiro
  if (isAdmin) {
    return (
      <Link href={`/inventario/consumibles/${index}/retirar`} className="block">
        {Inner}
      </Link>
    );
  }

  // Usuario normal: tarjeta informativa (no clicable, sin edición)
  return <div>{Inner}</div>;
}

function AddCard({
  onSave,
}: {
  onSave: (payload: { titulo: string; lugar: string; cantidad: number; imagen: File }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [lugar, setLugar] = useState("");
  const [cantidad, setCantidad] = useState<string>("");
  const [imagen, setImagen] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitulo("");
    setLugar("");
    setCantidad("");
    setImagen(null);
    setOpen(false);
    setSaving(false);
  };

  const handleSave = async () => {
    if (!titulo.trim() || !imagen || cantidad === "") {
      alert("Completa título, imagen y cantidad.");
      return;
    }
    const cant = Number(cantidad);
    if (Number.isNaN(cant) || cant < 0) {
      alert("Cantidad inválida.");
      return;
    }
    try {
      setSaving(true);
      await onSave({ titulo, lugar, cantidad: cant, imagen });
      reset();
    } catch (e) {
      console.error(e);
      setSaving(false);
      alert("Error al guardar.");
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="h-full min-h-40 bg-white text-black border rounded-xl flex flex-col items-center justify-center hover:shadow-sm"
        title="Agregar consumible"
      >
        <div className="w-12 h-12 rounded-full border flex items-center justify-center text-2xl">
          +
        </div>
        <span className="mt-2 text-xs text-gray-600">Agregar consumible</span>
      </button>
    );
  }

  return (
    <div className="bg-white text-black border rounded-xl p-3 shadow-sm">
      <h4 className="text-sm font-semibold mb-2">Nuevo consumible</h4>
      <div className="space-y-2">
        <input
          type="text"
          placeholder='Ej. "C1.Papel.Lija 400"'
          className="w-full border rounded px-3 py-2 text-sm"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
        <input
          type="text"
          placeholder="Lugar (ej. Gaveta A-1)"
          className="w-full border rounded px-3 py-2 text-sm"
          value={lugar}
          onChange={(e) => setLugar(e.target.value)}
        />
        <input
          type="number"
          min={0}
          placeholder="Cantidad"
          className="w-full border rounded px-3 py-2 text-sm"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
        />
        <input
          type="file"
          accept="image/*"
          className="w-full text-sm"
          onChange={(e) => setImagen(e.target.files?.[0] || null)}
        />

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={reset}
            className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
            type="button"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-2 rounded bg-black text-white text-sm hover:opacity-90 disabled:opacity-50"
            type="button"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
