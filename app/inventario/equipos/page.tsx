"use client";
import { useEffect, useState, useMemo } from "react";
import { getDownloadURL, ref, uploadBytes, deleteObject } from "firebase/storage";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db, storage } from "@/src/firebase/firebaseConfig";
import { useAuth } from "@/src/Context/AuthContext";
import { v4 as uuidv4 } from "uuid";

type Item = {
  titulo: string;        // Ej: "B1.XXX.Taladro 1"
  imagenURL: string;
  lugar: string;
  cantidad: number;
  etiquetas?: string[];  // <-- NUEVO
};

type DocData = {
  herramientas: Item[];
  equipos: Item[];
};

export default function EquiposInventarioPage() {
  const { isAdmin } = useAuth();
  const [herramientas, setHerramientas] = useState<Item[]>([]);
  const [equipos, setEquipos] = useState<Item[]>([]);
  const [openHerramientas, setOpenHerramientas] = useState(true);
  const [openEquipos, setOpenEquipos] = useState(true);

  const docRef = doc(db, "inventario", "equipos");

  const fetchData = async () => {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      const init: DocData = { herramientas: [], equipos: [] };
      await setDoc(docRef, init);
      setHerramientas([]);
      setEquipos([]);
      return;
    }
    const data = snap.data() as Partial<DocData>;
    // normalizar etiquetas a []
    setHerramientas((data.herramientas || []).map((x) => ({ ...x, etiquetas: Array.isArray(x.etiquetas) ? x.etiquetas : [] })));
    setEquipos((data.equipos || []).map((x) => ({ ...x, etiquetas: Array.isArray(x.etiquetas) ? x.etiquetas : [] })));
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ------ helpers ------
  const storagePathFromUrl = (url: string): string | null => {
    const match = decodeURIComponent(url).match(/\/o\/(.*?)\?alt/);
    return match?.[1]?.replace(/%2F/g, "/") ?? null;
  };

  // Guardar nuevo item (se llama desde cada sección)
  const saveNewItem = async (
    categoria: "herramientas" | "equipos",
    payload: { titulo: string; lugar: string; cantidad: number; imagen: File; etiquetas: string[] } // <-- NUEVO
  ) => {
    // 1) Subir imagen
    const id = uuidv4();
    const path = `inventario/equipos/${categoria}/${id}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, payload.imagen);
    const imagenURL = await getDownloadURL(storageRef);

    // 2) Preparar doc
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, { herramientas: [], equipos: [] } as DocData);
    }
    const data = (await getDoc(docRef)).data() as DocData;

    const nuevo: Item = {
      titulo: payload.titulo.trim(),
      lugar: payload.lugar.trim(),
      cantidad: payload.cantidad,
      imagenURL,
      etiquetas: payload.etiquetas, // <-- NUEVO
    };

    const nuevos =
      categoria === "herramientas"
        ? { herramientas: [...(data.herramientas || []), nuevo], equipos: data.equipos || [] }
        : { herramientas: data.herramientas || [], equipos: [...(data.equipos || []), nuevo] };

    await updateDoc(docRef, nuevos);
    await fetchData();
  };

  // Eliminar item (borra imagen + actualiza array)
  const deleteItem = async (
    categoria: "herramientas" | "equipos",
    index: number
  ) => {
    if (!isAdmin) return;
    const current = (await getDoc(docRef)).data() as DocData;
    const arr = (categoria === "herramientas" ? current.herramientas : current.equipos) || [];
    const item = arr[index];
    if (!item) return;

    // 1) eliminar imagen de Storage (best-effort)
    const path = storagePathFromUrl(item.imagenURL);
    if (path) {
      try {
        await deleteObject(ref(storage, path));
      } catch (err) {
        console.warn("No se pudo eliminar la imagen del Storage:", err);
      }
    }

    // 2) actualizar Firestore filtrando el índice
    const nuevoArr = arr.filter((_, i) => i !== index);
    const nuevos =
      categoria === "herramientas"
        ? { herramientas: nuevoArr, equipos: current.equipos || [] }
        : { herramientas: current.herramientas || [], equipos: nuevoArr };

    await updateDoc(docRef, nuevos);
    await fetchData();
  };

  return (
    <div className="max-w-7xl mx-auto bg-white text-black rounded-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Equipos y herramientas</h1>
        <button
          onClick={() => window.history.back()}
          className="bg-black text-white px-4 py-2 rounded hover:opacity-90"
        >
          ← Regresar
        </button>
      </div>

      {/* Sección Herramientas */}
      <Section
        title="Herramientas"
        open={openHerramientas}
        onToggle={() => setOpenHerramientas((v) => !v)}
        items={herramientas}
        isAdmin={!!isAdmin}
        categoria="herramientas"
        onAdd={saveNewItem}
        onDelete={deleteItem}
      />

      {/* Sección Equipos */}
      <Section
        title="Equipos"
        open={openEquipos}
        onToggle={() => setOpenEquipos((v) => !v)}
        items={equipos}
        isAdmin={!!isAdmin}
        categoria="equipos"
        onAdd={saveNewItem}
        onDelete={deleteItem}
      />
    </div>
  );
}

/* ---------- Subcomponentes ---------- */

function Section({
  title,
  open,
  onToggle,
  items,
  isAdmin,
  categoria,
  onAdd,
  onDelete,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  items: Item[];
  isAdmin: boolean;
  categoria: "herramientas" | "equipos";
  onAdd: (categoria: "herramientas" | "equipos", payload: { titulo: string; lugar: string; cantidad: number; imagen: File; etiquetas: string[] }) => Promise<void>;
  onDelete: (categoria: "herramientas" | "equipos", index: number) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [lugar, setLugar] = useState("");
  const [cantidad, setCantidad] = useState<string>("");
  const [imagen, setImagen] = useState<File | null>(null);
  const [etiquetasStr, setEtiquetasStr] = useState(""); // <-- NUEVO
  const [saving, setSaving] = useState(false);

  const [q, setQ] = useState(""); // <-- NUEVO: buscador por sección

  const reset = () => {
    setTitulo("");
    setLugar("");
    setCantidad("");
    setImagen(null);
    setEtiquetasStr("");
    setShowForm(false);
    setSaving(false);
  };

  const parseEtiquetas = (raw: string): string[] => {
    const arr = (raw || "")
      .split(/[,;\n]/g)
      .map((s) => s.trim())
      .filter(Boolean);
    // quitar duplicados preservando orden
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of arr) {
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    return out;
  };

  const handleSave = async () => {
    if (!isAdmin) return;
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
      await onAdd(categoria, { titulo, lugar, cantidad: cant, imagen, etiquetas: parseEtiquetas(etiquetasStr) });
      reset();
    } catch (e) {
      console.error(e);
      alert("Error al guardar.");
      setSaving(false);
    }
  };

  const normalize = (s: string) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

  const filtered = useMemo(() => {
    const needle = normalize(q.trim());
    if (!needle) return items;
    return items.filter((it) => {
      const inTitle = normalize(it.titulo).includes(needle);
      const inTags = (it.etiquetas || []).some((tg) => normalize(tg).includes(needle));
      return inTitle || inTags;
    });
  }, [items, q]);

  return (
    <div className="border rounded-xl mb-6">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-gray-500">{open ? "Ocultar" : "Mostrar"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {/* Buscador por sección */}
          <div className="flex items-center gap-2 pb-3">
            <input
              type="text"
              placeholder={`Buscar ${title.toLowerCase()} por título o etiqueta…`}
              className="w-full sm:w-96 border rounded px-3 py-2 text-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="text-xs px-3 py-2 border rounded hover:bg-gray-50"
              >
                Limpiar
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {isAdmin && (
                <AddCard
                  showForm={showForm}
                  onOpen={() => setShowForm(true)}
                  onCancel={reset}
                  titulo={titulo}
                  setTitulo={setTitulo}
                  lugar={lugar}
                  setLugar={setLugar}
                  cantidad={cantidad}
                  setCantidad={setCantidad}
                  setImagen={setImagen}
                  etiquetasStr={etiquetasStr}
                  setEtiquetasStr={setEtiquetasStr}
                  onSave={handleSave}
                  saving={saving}
                />
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map((it, idx) => (
                <Card
                  key={idx}
                  item={it}
                  isAdmin={isAdmin}
                  onDelete={() => onDelete(categoria, idx)}
                  onTagClick={(t) => setQ(t)} // clic en chip aplica búsqueda
                />
              ))}
              {isAdmin && (
                <AddCard
                  showForm={showForm}
                  onOpen={() => setShowForm(true)}
                  onCancel={reset}
                  titulo={titulo}
                  setTitulo={setTitulo}
                  lugar={lugar}
                  setLugar={setLugar}
                  cantidad={cantidad}
                  setCantidad={setCantidad}
                  setImagen={setImagen}
                  etiquetasStr={etiquetasStr}
                  setEtiquetasStr={setEtiquetasStr}
                  onSave={handleSave}
                  saving={saving}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Card({
  item,
  isAdmin,
  onDelete,
  onTagClick,
}: {
  item: Item;
  isAdmin: boolean;
  onDelete: () => void;
  onTagClick: (tag: string) => void;
}) {
  return (
    <div className="relative bg-white text-black border rounded-xl overflow-hidden shadow-sm">
      {/* Botón borrar (solo admin) */}
      {isAdmin && (
        <button
          onClick={onDelete}
          className="absolute right-2 top-2 w-6 h-6 rounded-full bg-white border text-gray-700 hover:bg-gray-100 text-xs"
          title="Eliminar"
        >
          ×
        </button>
      )}

      {/* Título arriba (pequeño) */}
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

      {/* Lugar / Cantidad / Etiquetas */}
      <div className="px-3 py-2 text-xs">
        <div>
          <span className="font-semibold">Lugar:</span>{" "}
          <span className="text-gray-700">{item.lugar || "—"}</span>
        </div>
        <div>
          <span className="font-semibold">Cantidad:</span>{" "}
          <span className="text-gray-700">
            {typeof item.cantidad === "number" ? item.cantidad : "—"}
          </span>
        </div>

        {(item.etiquetas && item.etiquetas.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.etiquetas.map((tag, i) => (
              <button
                key={`${tag}-${i}`}
                onClick={() => onTagClick(tag)}
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
}

function AddCard({
  showForm,
  onOpen,
  onCancel,
  titulo,
  setTitulo,
  lugar,
  setLugar,
  cantidad,
  setCantidad,
  setImagen,
  etiquetasStr,
  setEtiquetasStr,
  onSave,
  saving,
}: {
  showForm: boolean;
  onOpen: () => void;
  onCancel: () => void;
  titulo: string;
  setTitulo: (v: string) => void;
  lugar: string;
  setLugar: (v: string) => void;
  cantidad: string;
  setCantidad: (v: string) => void;
  setImagen: (f: File | null) => void;
  etiquetasStr: string;                 // <-- NUEVO
  setEtiquetasStr: (v: string) => void; // <-- NUEVO
  onSave: () => void;
  saving: boolean;
}) {
  if (!showForm) {
    return (
      <button
        onClick={onOpen}
        className="h-full min-h-40 bg-white text-black border rounded-xl flex flex-col items-center justify-center hover:shadow-sm"
        title="Agregar item"
      >
        <div className="w-12 h-12 rounded-full border flex items-center justify-center text-2xl">
          +
        </div>
        <span className="mt-2 text-xs text-gray-600">Agregar item</span>
      </button>
    );
  }

  return (
    <div className="bg-white text-black border rounded-xl p-3 shadow-sm">
      <h4 className="text-sm font-semibold mb-2">Nuevo item</h4>
      <div className="space-y-2">
        <input
          type="text"
          placeholder='Ej. "B1.XXX.Taladro"'
          className="w-full border rounded px-3 py-2 text-sm"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
        <input
          type="text"
          placeholder="Lugar (ej. Gaveta A-3)"
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
        {/* NUEVO: Etiquetas */}
        <div>
          <input
            type="text"
            placeholder='Etiquetas (ej. "taladro, eléctrico, dewalt")'
            className="w-full border rounded px-3 py-2 text-sm"
            value={etiquetasStr}
            onChange={(e) => setEtiquetasStr(e.target.value)}
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Separa por comas (ej. <code>taladro, eléctrico, dewalt</code>)
          </p>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onCancel}
            className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
            type="button"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-3 py-2 rounded bg-black text-white text-sm hover:opacity-90 disabled:opacity-50"
            type="button"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
