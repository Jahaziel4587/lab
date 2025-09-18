// app/cotizador/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Parser } from "expr-eval";
import { db } from "@/src/firebase/firebaseConfig";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type CollectionReference,
  type DocumentData,
  type Query as FsQuery,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";

/* =====================================
 * Tipos
 * ===================================== */

type ViewKey = "cotizacion" | "calculadora" | "tabla" | "servicios";

type FieldType = "number" | "text" | "select" | "boolean" | "time" | "dimensions";
type ServiceField = {
  key: string; // nombre de variable (snake_case)
  label: string; // etiqueta visible
  type: FieldType;
  options?: string[]; // para select
};

type ServiceDoc = {
  name: string;
  fields: ServiceField[];
  createdAt?: any;
};

type GroupDoc = {
  name: string;
  createdAt?: any;
};

type RowDoc = {
  key: string; // nombre de variable
  value?: number | null; // solo para Tabla de costos (valor fijo)
  expr?: string; // solo para Calculadora (fórmula)
  inTotal?: boolean; // considerar en total (Calculadora)
  createdAt?: any;
};

type SettingsDoc = {
  currency: "MXN" | "USD";
  exchangeRate: number; // MXN por USD
  iva: number; // 0.16 = 16%
};

/* =====================================
 * Constantes de colecciones
 * ===================================== */

const COL_SERVICES = "services"; // { name, fields[] }
const COL_COST_TABLES = "cost_tables"; // docs: { name } / subcoll rows
const COL_CALCULATORS = "calculators"; // docs: { name } / subcoll rows
const COL_SETTINGS = "cotizador_settings"; // doc único "default"

/* =====================================
 * Utilidades
 * ===================================== */

const parser = new Parser();

const snake = (s: string) =>
  s
    .normalize("NFD")
    // @ts-ignore - soporte para \p{Diacritic}
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_{2,}/g, "_");

function safeEval(expr: string, vars: Record<string, number>): number | null {
  try {
    const v = parser.parse(expr).evaluate(vars);
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return null;
  } catch {
    return null;
  }
}

function buildContext(
  fromCostTable: Record<string, number>,
  fromQuote: Record<string, number>,
  fromCalculator: Record<string, number>
): Record<string, number> {
  return { ...fromCostTable, ...fromQuote, ...fromCalculator };
}

function findConflicts(
  name: string,
  sources: { where: "tabla" | "cotizacion" | "calculadora"; has: boolean }[]
): string | null {
  const definedIn = sources.filter((s) => s.has).map((s) => s.where);
  if (definedIn.length > 1) {
    return `Conflicto: "${name}" ya está definida en ${definedIn.join(" y ")}.`;
  }
  return null;
}

/* =====================================
 * Hooks Firestore tipados
 * ===================================== */

function useColl<T = DocumentData>(path: string, constraints: QueryConstraint[] = []) {
  const [data, setData] = useState<Array<{ id: string; data: T }>>([]);

  useEffect(() => {
    const ref = collection(db, path) as CollectionReference<T>;
    const q = (constraints.length ? query(ref, ...constraints) : ref) as FsQuery<T>;

    const unsub = onSnapshot(q, (snap: QuerySnapshot<T>) => {
      const out: Array<{ id: string; data: T }> = [];
      snap.forEach((d: QueryDocumentSnapshot<T>) => {
        out.push({ id: d.id, data: d.data() as T });
      });
      setData(out);
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, JSON.stringify(constraints)]);

  return data;
}

function useSubColl<T = DocumentData>(parentPath: string, sub: string) {
  const [data, setData] = useState<Array<{ id: string; data: T }>>([]);

  useEffect(() => {
    if (!parentPath) return;
    const ref = collection(db, `${parentPath}/${sub}`) as CollectionReference<T>;
    const q = query(ref, orderBy("createdAt", "asc")) as FsQuery<T>;
    const unsub = onSnapshot(q, (snap: QuerySnapshot<T>) => {
      const out: Array<{ id: string; data: T }> = [];
      snap.forEach((d: QueryDocumentSnapshot<T>) => out.push({ id: d.id, data: d.data() as T }));
      setData(out);
    });
    return () => unsub();
  }, [parentPath, sub]);

  return data;
}

/* =====================================
 * Página principal
 * ===================================== */

export default function CotizadorPage() {
  const router = useRouter();
  const search = useSearchParams();
  const initial = (search.get("view") as ViewKey) || "cotizacion";

  const [collapsed, setCollapsed] = useState(false);
  const [view, setView] = useState<ViewKey>(initial);

  useEffect(() => {
    const current = search.get("view");
    if (current !== view) {
      const params = new URLSearchParams(Array.from(search.entries()));
      params.set("view", view);
      router.replace(`?${params.toString()}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  return (
    <div className="min-h-[calc(100vh-64px)]">
      <div className="max-w-7xl mx-auto p-4 md:p-6 flex gap-4">
        {/* Sidebar */}
        <aside
          className={[
            "bg-white rounded-2xl shadow p-3 md:p-4 h-max sticky top-4 transition-all",
            collapsed ? "w-14" : "w-64",
          ].join(" ")}
          aria-label="Menú del cotizador"
        >
          <div className="flex items-center justify-between mb-3">
            {!collapsed && <h2 className="text-lg font-bold">Cotizador</h2>}
            <button
              aria-label="Alternar menú"
              className="p-2 rounded-lg border hover:bg-neutral-100"
              onClick={() => setCollapsed((v) => !v)}
              title="Mostrar/ocultar menú"
            >
              <div className="w-5 space-y-1">
                <div className="h-0.5 bg-black" />
                <div className="h-0.5 bg-black" />
                <div className="h-0.5 bg-black" />
              </div>
            </button>
          </div>

          <nav className="flex flex-col gap-2">
            {[
              { key: "cotizacion", label: "Cotización" },
              { key: "calculadora", label: "Calculadora" },
              { key: "tabla", label: "Tabla de costos" },
              { key: "servicios", label: "Servicios" },
            ].map(({ key, label }) => {
              const active = view === (key as ViewKey);
              return (
                <button
                  key={key}
                  onClick={() => setView(key as ViewKey)}
                  title={label}
                  className={[
                    "group w-full px-3 py-2 rounded-xl border transition flex items-center gap-2",
                    active
                      ? "bg-black text-white border-black"
                      : "bg-white text-black border-neutral-300 hover:bg-neutral-100",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-block w-2.5 h-2.5 rounded-full",
                      active ? "bg-white" : "bg-black",
                    ].join(" ")}
                  />
                  {!collapsed && <span className="truncate">{label}</span>}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Panel derecho */}
        <section className="flex-1 bg-white rounded-2xl shadow p-4 md:p-6">
          {view === "cotizacion" && <CotizacionPanel />}
          {view === "servicios" && <ServiciosPanel />}
          {view === "tabla" && <TablaCostosPanel />}
          {view === "calculadora" && <CalculadoraPanel />}
        </section>
      </div>
    </div>
  );
}

/* =====================================
 * Panel: Cotización (flujo + moneda + total + adjuntar)
 * ===================================== */

function CotizacionPanel() {
  const [settings, setSettings] = useState<SettingsDoc | null>(null);

  // Crea/lee settings default
  useEffect(() => {
    const ref = doc(db, COL_SETTINGS, "default");
    // Asegura doc con defaults (merge evita sobreescrituras involuntarias)
    setDoc(ref, { currency: "MXN", exchangeRate: 17, iva: 0.16 }, { merge: true });
    const unsub = onSnapshot(ref, (snap) => {
      const data = (snap.data() || { currency: "MXN", exchangeRate: 17, iva: 0.16 }) as SettingsDoc;
      setSettings(data);
    });
    return () => unsub();
  }, []);

  // Proyectos desde pedidos (únicos por campo "proyecto" o titulo)
  const pedidos = useColl<any>("pedidos");
  const proyectos = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach((p) => {
      const name = p.data.proyecto || p.data.titulo || "Sin nombre";
      set.add(name);
    });
    return Array.from(set).sort();
  }, [pedidos]);

  const [project, setProject] = useState<string>("");
  const pedidosDelProyecto = useMemo(() => {
    return pedidos.filter((p) => {
      const name = p.data.proyecto || p.data.titulo || "Sin nombre";
      return !project || name === project;
    });
  }, [pedidos, project]);

  // Servicios disponibles
  const services = useColl<ServiceDoc>(COL_SERVICES);

  const [pedidoId, setPedidoId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");

  // Respuestas (variables) de cotización
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [selects, setSelects] = useState<Record<string, string>>({});
  const selService = services.find((s) => s.id === serviceId)?.data;

  // Contexto de costos (desde tabla de costos) — merge
  const costTablesGroups = useColl<GroupDoc>(COL_COST_TABLES);
  const [selectedCostGroup, setSelectedCostGroup] = useState<string>("");
  const costRows = useSubColl<RowDoc>(
    selectedCostGroup ? `${COL_COST_TABLES}/${selectedCostGroup}` : "",
    "rows"
  );
  const costVars = useMemo(() => {
    const out: Record<string, number> = {};
    costRows.forEach((r) => {
      if (r.data.key && typeof r.data.value === "number") out[r.data.key] = r.data.value!;
    });
    return out;
  }, [costRows]);

  // Calculadora del servicio seleccionado (grupo elegido)
  const calcGroups = useColl<GroupDoc>(COL_CALCULATORS);
  const [activeCalcGroup, setActiveCalcGroup] = useState<string>("");
  const calcRows = useSubColl<RowDoc>(
    activeCalcGroup ? `${COL_CALCULATORS}/${activeCalcGroup}` : "",
    "rows"
  );

  // Resolver calculadora con prioridad: calc > answers > tabla
  const resolvedCalc = useMemo(() => {
    const result: Record<string, number> = {};
    // iteramos varias pasadas por dependencias cruzadas
    for (let pass = 0; pass < 6; pass++) {
      let progress = false;
      calcRows.forEach((r) => {
        if (!r.data.key || !r.data.expr) return;
        if (result[r.data.key] !== undefined) return;
        const ctx = buildContext(costVars, answers, result);
        const v = safeEval(r.data.expr!, ctx);
        if (v !== null) {
          result[r.data.key] = v;
          progress = true;
        }
      });
      if (!progress) break;
    }
    return result;
  }, [calcRows, costVars, answers]);

  const total = useMemo(() => {
    return calcRows
      .filter((r) => r.data.inTotal)
      .map((r) => resolvedCalc[r.data.key] ?? 0)
      .reduce((a, b) => a + b, 0);
  }, [calcRows, resolvedCalc]);

  const currency = settings?.currency || "MXN";
  const rate = settings?.exchangeRate || 17;
  const displayTotal = currency === "MXN" ? total : total / rate;

  return (
    <div className="space-y-6 text-neutral-900">
      <h3 className="text-xl font-semibold">Cotización</h3>

      {/* Moneda */}
      <div className="flex flex-wrap items-end gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
        <div>
          <label className="block text-sm font-medium">Moneda</label>
          <select
            className="mt-1 border border-neutral-300 rounded-lg px-3 py-2"
            value={currency}
            onChange={async (e) => {
              const val = e.target.value as "MXN" | "USD";
              await setDoc(doc(db, COL_SETTINGS, "default"), { currency: val }, { merge: true });
            }}
          >
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Tasa USD→MXN</label>
          <input
            type="number"
            step="0.0001"
            className="mt-1 border border-neutral-300 rounded-lg px-3 py-2 w-32 placeholder-neutral-500"
            value={rate}
            onChange={async (e) => {
              const v = parseFloat(e.target.value) || 0;
              await setDoc(doc(db, COL_SETTINGS, "default"), { exchangeRate: v }, { merge: true });
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">IVA</label>
          <input
            type="number"
            step="0.0001"
            className="mt-1 border border-neutral-300 rounded-lg px-3 py-2 w-24"
            value={settings?.iva ?? 0.16}
            onChange={async (e) => {
              const v = parseFloat(e.target.value) || 0;
              await setDoc(doc(db, COL_SETTINGS, "default"), { iva: v }, { merge: true });
            }}
          />
        </div>
      </div>

      {/* Paso 1: Proyecto */}
      <div>
        <label className="block text-sm font-medium">1) Proyecto a cotizar</label>
        <select
          className="mt-1 border border-neutral-300 rounded-lg px-3 py-2"
          value={project}
          onChange={(e) => {
            setProject(e.target.value);
            setPedidoId("");
          }}
        >
          <option value="">— Selecciona —</option>
          {proyectos.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* Paso 2: Pedido */}
      <div>
        <label className="block text-sm font-medium">2) Pedido del proyecto</label>
        <select
          className="mt-1 border border-neutral-300 rounded-lg px-3 py-2"
          value={pedidoId}
          onChange={(e) => setPedidoId(e.target.value)}
        >
          <option value="">— Selecciona —</option>
          {pedidosDelProyecto.map((p) => (
            <option key={p.id} value={p.id}>
              {p.data.titulo || p.data.proyecto || p.id}
            </option>
          ))}
        </select>
      </div>

      {/* Paso 3: Servicio */}
      <div>
        <label className="block text-sm font-medium">3) Servicio</label>
        <select
          className="mt-1 border border-neutral-300 rounded-lg px-3 py-2"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
        >
          <option value="">— Selecciona —</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.data.name}
            </option>
          ))}
        </select>
      </div>

      {/* Campos dinámicos por Servicio */}
      {selService && (
        <div className="space-y-3">
          <h4 className="font-semibold">Parámetros del servicio</h4>
          {selService.fields.map((f) => (
            f.type === "select" ? (
              <ServiceSelectInput
                key={f.key}
                field={f}
                value={selects[f.key]}
                onChange={(val) => {
                  setSelects((s) => ({ ...s, [f.key]: val }));
                  // One-hot automático: is_<campo>_<opcion>
                  const base = `is_${f.key}_`;
                  setAnswers((prev) => {
                    const next = { ...prev };
                    (f.options || []).forEach((opt) => {
                      next[`${base}${snake(opt)}`] = 0;
                    });
                    if (val) next[`${base}${snake(val)}`] = 1;
                    return next;
                  });
                }}
              />
            ) : (
              <ServiceFieldInput
                key={f.key}
                field={f}
                value={answers[f.key]}
                onChange={(val) => {
                if (val === null) {
                  setAnswers((prev) => {
                    const { [f.key]: _omit, ...rest } = prev;
                    return rest;
                  });
                  return;
                }
                const conflict = findConflicts(
                  f.key,
                  [
                    { where: "tabla", has: f.key in Object(costVars) },
                    { where: "cotizacion", has: f.key in answers },
                    { where: "calculadora", has: false },
                  ]
                );
                if (conflict && !(f.key in answers)) alert(conflict);
                setAnswers((a) => ({ ...a, [f.key]: val }));
              }}
              />
            )
          ))}
        </div>
      )}

      {/* Selección de Tabla/Calculadora */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm font-medium">Tabla de costos aplicada</label>
          <select
            className="mt-1 border border-neutral-300 rounded-lg px-3 py-2"
            value={selectedCostGroup}
            onChange={(e) => setSelectedCostGroup(e.target.value)}
          >
            <option value="">— Ninguna —</option>
            {costTablesGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.data.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Calculadora</label>
          <select
            className="mt-1 border border-neutral-300 rounded-lg px-3 py-2"
            value={activeCalcGroup}
            onChange={(e) => setActiveCalcGroup(e.target.value)}
          >
            <option value="">— Calculadora —</option>
            {calcGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.data.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Total */}
      <div className="p-4 border border-neutral-200 rounded-xl bg-neutral-50">
        <div className="text-lg font-semibold">
          Total: {currency} {displayTotal.toFixed(2)}
        </div>
        <p className="text-sm text-neutral-500">
          (Suma de filas marcadas "inTotal" en la Calculadora seleccionada)
        </p>
      </div>

      {/* Adjuntar servicio (stub) */}
      <div className="flex gap-2">
        <button
          className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50"
          disabled={!pedidoId || !serviceId}
          onClick={() => {
            alert(
              `Adjuntado (simulado): pedido=${pedidoId}, servicio=${serviceId}\n` +
                `variables: ${JSON.stringify(answers, null, 2)}\n` +
                `total ${currency} ${displayTotal.toFixed(2)}`
            );
          }}
        >
          Adjuntar servicio a la cotización
        </button>
      </div>
    </div>
  );
}

function ServiceSelectInput({
  field,
  value,
  onChange,
}: {
  field: ServiceField;
  value?: string;
  onChange: (v: string) => void;
}) {
  const opts = field.options || [];
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-800">
        {field.label} ({field.key})
      </label>
      <select
        className="mt-1 border border-neutral-300 rounded-lg px-3 py-2 w-full"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Selecciona —</option>
        {opts.map((o, i) => (
          <option key={i} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function ServiceFieldInput({
  field,
  value,
  onChange,
}: {
  field: ServiceField;
  value?: number;
  onChange: (v: number | null) => void;
}) {
  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-neutral-800">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked ? 1 : 0)}
        />
        {field.label}
      </label>
    );
  }
  // Simplificación: number/text/time/dimensions → number. Permitimos vacío.
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-800">
        {field.label} ({field.key})
      </label>
      <input
        type="number"
        step="0.0001"
        className="mt-1 border border-neutral-300 rounded-lg px-3 py-2 w-full placeholder-neutral-500 text-neutral-900"
        value={value === undefined ? "" : value}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(null); // permite borrar sin que aparezca 0
          } else {
            const num = Number(raw);
            if (!Number.isNaN(num)) onChange(num);
          }
        }}
        placeholder="0"
      />
    </div>
  );
}

/* =====================================
 * Panel: Servicios (CRUD)
 * ===================================== */

function ServiciosPanel() {
  const services = useColl<ServiceDoc>(COL_SERVICES);

  const [name, setName] = useState("");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("number");
  const [newFieldOptions, setNewFieldOptions] = useState("");

  return (
    <div className="space-y-6 text-neutral-900">
      <div className="flex items-end gap-2">
        <div>
          <label className="block text-sm font-medium">Nuevo servicio</label>
          <input
            className="mt-1 border border-neutral-300 rounded-lg px-3 py-2"
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
              {newFieldType === "select" && (
                <div>
                  <label className="block text-sm font-medium">Opciones (coma separadas)</label>
                  <input
                    className="mt-1 border border-neutral-300 rounded-lg px-3 py-2"
                    placeholder="Ej: PLA, ABS, PETG"
                    value={newFieldOptions}
                    onChange={(e) => setNewFieldOptions(e.target.value)}
                  />
                </div>
              )}
              <button
          className="px-3 py-2 rounded-lg bg-black text-white hover:opacity-90"
          onClick={async () => {
            const n = name.trim();
            if (!n) return;
            await addDoc(collection(db, COL_SERVICES), {
              name: n,
              fields: [],
              createdAt: serverTimestamp(),
            } as ServiceDoc);
            setName("");
          }}
        >
          + Agregar
        </button>
      </div>

      <div className="grid gap-4">
        {services.map((s) => (
          <div key={s.id} className="border border-neutral-200 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">{s.data.name}</h4>
              <button
                className="text-sm text-red-600 hover:underline"
                onClick={async () => {
                  await deleteDoc(doc(db, COL_SERVICES, s.id));
                }}
              >
                Eliminar
              </button>
            </div>

            {/* Campos */}
            <div className="mt-2 space-y-2">
              {s.data.fields?.map((f, idx) => (
                <div key={idx} className="flex items-center gap-2 text-neutral-700">
                  <span className="text-sm w-40 truncate">{f.label}</span>
                  <span className="text-xs text-neutral-500">({f.key})</span>
                </div>
              ))}
            </div>

            {/* Agregar campo */}
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-sm font-medium">Nuevo campo</label>
                <input
                  className="mt-1 border border-neutral-300 rounded-lg px-3 py-2"
                  placeholder="Etiqueta"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Tipo</label>
                <select
                  className="mt-1 border border-neutral-300 rounded-lg px-3 py-2"
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as FieldType)}
                >
                  <option value="number">number</option>
                  <option value="text">text</option>
                  <option value="boolean">boolean</option>
                  <option value="select">select</option>
                  <option value="time">time</option>
                  <option value="dimensions">dimensions</option>
                </select>
              </div>
              <button
                className="px-3 py-2 rounded-lg bg-black text-white hover:opacity-90"
                onClick={async () => {
                  const lab = newFieldLabel.trim();
                  if (!lab) return;
                  const key = snake(lab);
                  const payload: ServiceField = { key, label: lab, type: newFieldType } as ServiceField;
                  if (newFieldType === "select") {
                    const opts = newFieldOptions
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean);
                    (payload as any).options = opts;
                  }
                  const updated = [...(s.data.fields || []), payload];
                  await updateDoc(doc(db, COL_SERVICES, s.id), { fields: updated });
                  setNewFieldLabel("");
                  setNewFieldOptions("");
                }}
              >
                + Campo
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =====================================
 * Panel: Tabla de costos (grupos + filas con valores fijos)
 * ===================================== */

function TablaCostosPanel() {
  const groups = useColl<GroupDoc>(COL_COST_TABLES);
  const [selected, setSelected] = useState<string>("");
  const rows = useSubColl<RowDoc>(selected ? `${COL_COST_TABLES}/${selected}` : "", "rows");

  const [groupName, setGroupName] = useState("");
  const [varName, setVarName] = useState("");
  const [varValue, setVarValue] = useState<number | "">("");

  return (
    <div className="space-y-6 text-neutral-900">
      <div className="flex items-end gap-2">
        <div>
          <label className="block text-sm font-medium">Nueva subcategoría</label>
          <input
            className="mt-1 border border-neutral-300 rounded-lg px-3 py-2"
            placeholder="Nombre"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        </div>
        <button
          className="px-3 py-2 rounded-lg bg-black text-white hover:opacity-90"
          onClick={async () => {
            const n = groupName.trim();
            if (!n) return;
            const ref = await addDoc(collection(db, COL_COST_TABLES), {
              name: n,
              createdAt: serverTimestamp(),
            });
            setGroupName("");
            setSelected(ref.id);
          }}
        >
          + Agregar
        </button>
      </div>

      <div className="flex gap-2 items-center">
        <label className="text-sm">Subcategoría:</label>
        <select
          className="border border-neutral-300 rounded-lg px-3 py-2"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">— Selecciona —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.data.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tabla dos columnas */}
      <div className="border border-neutral-200 rounded-xl overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2 w-1/2 text-neutral-700 font-medium">Variable</th>
              <th className="text-left px-3 py-2 w-1/2 text-neutral-700 font-medium">Valor (MXN)</th>
            </tr>
          </thead>
          <tbody className="text-neutral-800">
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-neutral-200">
                <td className="px-3 py-2">{r.data.key}</td>
                <td className="px-3 py-2">{r.data.value ?? "—"}</td>
              </tr>
            ))}
            {selected && (
              <tr className="border-t border-neutral-200 bg-neutral-50">
                <td className="px-3 py-2">
                  <input
                    className="border border-neutral-300 rounded-lg px-2 py-1 w-full"
                    placeholder="nombre_variable"
                    value={varName}
                    onChange={(e) => setVarName(snake(e.target.value))}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.0001"
                    className="border border-neutral-300 rounded-lg px-2 py-1 w-full"
                    placeholder="0"
                    value={varValue}
                    onChange={(e) =>
                      setVarValue(e.target.value === "" ? "" : parseFloat(e.target.value))
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded-lg bg-black text-white hover:opacity-90"
            onClick={async () => {
              const k = varName.trim();
              if (!k || varValue === "") return;
              const conflict = findConflicts(k, [
                { where: "tabla", has: rows.some((r) => r.data.key === k) },
                { where: "cotizacion", has: false },
                { where: "calculadora", has: false },
              ]);
              if (conflict) {
                alert(conflict);
                return;
              }
              await addDoc(collection(db, `${COL_COST_TABLES}/${selected}/rows`), {
                key: k,
                value: Number(varValue),
                createdAt: serverTimestamp(),
              } as RowDoc);
              setVarName("");
              setVarValue("");
            }}
          >
            + Agregar fila
          </button>
        </div>
      )}
    </div>
  );
}

/* =====================================
 * Panel: Calculadora (grupos + filas con fórmulas + barra de fórmula)
 * ===================================== */

function CalculadoraPanel() {
  const groups = useColl<GroupDoc>(COL_CALCULATORS);
  const [selected, setSelected] = useState<string>("");
  const rows = useSubColl<RowDoc>(selected ? `${COL_CALCULATORS}/${selected}` : "", "rows");

  // Contexto para vista previa: tabla de costos elegida
  const allCostGroups = useColl<GroupDoc>(COL_COST_TABLES);
  const [costGroupForPreview, setCostGroupForPreview] = useState<string>("");
  const costRows = useSubColl<RowDoc>(
    costGroupForPreview ? `${COL_COST_TABLES}/${costGroupForPreview}` : "",
    "rows"
  );
  const costVars = useMemo(() => {
    const out: Record<string, number> = {};
    costRows.forEach((r) => {
      if (r.data.key && typeof r.data.value === "number") out[r.data.key] = r.data.value!;
    });
    return out;
  }, [costRows]);

  const [groupName, setGroupName] = useState("");
  const [varName, setVarName] = useState("");
  const [expr, setExpr] = useState("");
  const [inTotal, setInTotal] = useState(true);

  // Fila en edición (barra de fórmula)
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const currentRow = rows.find((r) => r.id === editingRow);

  // Vista previa de cálculos
  const previewValues = useMemo(() => {
    const result: Record<string, number> = {};
    for (let pass = 0; pass < 6; pass++) {
      let progress = false;
      rows.forEach((r) => {
        if (!r.data.expr || !r.data.key) return;
        if (result[r.data.key] !== undefined) return;
        const ctx = buildContext(costVars, {}, result);
        const v = safeEval(r.data.expr, ctx);
        if (v !== null) {
          result[r.data.key] = v;
          progress = true;
        }
      });
      if (!progress) break;
    }
    return result;
  }, [rows, costVars]);

  const subtotal = rows
    .filter((r) => r.data.inTotal)
    .reduce((a, r) => a + (previewValues[r.data.key] ?? 0), 0);

  return (
    <div className="space-y-6 text-neutral-900">
      {/* Subcategorías */}
      <div className="flex items-end gap-2">
        <div>
          <label className="block text-sm font-medium">Nueva subcategoría</label>
          <input
            className="mt-1 border border-neutral-300 rounded-lg px-3 py-2"
            placeholder="Nombre"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        </div>
        <button
          className="px-3 py-2 rounded-lg bg-black text-white hover:opacity-90"
          onClick={async () => {
            const n = groupName.trim();
            if (!n) return;
            const ref = await addDoc(collection(db, COL_CALCULATORS), {
              name: n,
              createdAt: serverTimestamp(),
            });
            setGroupName("");
            setSelected(ref.id);
          }}
        >
          + Agregar
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm">Subcategoría:</label>
          <select
            className="border border-neutral-300 rounded-lg px-3 py-2"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">— Selecciona —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.data.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm">Tabla de costos (preview):</label>
          <select
            className="border border-neutral-300 rounded-lg px-3 py-2"
            value={costGroupForPreview}
            onChange={(e) => setCostGroupForPreview(e.target.value)}
          >
            <option value="">— Ninguna —</option>
            {allCostGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.data.name}
              </option>
            ))}
          </select>
        </div>

        {editingRow && (
          <div className="flex-1">
            <label className="block text-sm font-medium">Barra de fórmula</label>
            <input
              className="mt-1 border border-neutral-300 rounded-lg px-3 py-2 w-full"
              placeholder="Ej: costo_material + tiempo_pre * tarifa_hora"
              value={currentRow?.data.expr ?? ""}
              onChange={async (e) => {
                const v = e.target.value;
                await updateDoc(doc(db, `${COL_CALCULATORS}/${selected}/rows`, editingRow), { expr: v });
              }}
            />
          </div>
        )}
      </div>

      {/* Tabla dos columnas */}
      <div className="border border-neutral-200 rounded-xl overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="text-left px-3 py-2 w-1/2 text-neutral-700 font-medium">Variable</th>
              <th className="text-left px-3 py-2 w-1/2 text-neutral-700 font-medium">Valor (preview)</th>
            </tr>
          </thead>
          <tbody className="text-neutral-800">
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-neutral-200 hover:bg-neutral-50">
                <td className="px-3 py-2">
                  <button
                    className="underline"
                    onClick={() => setEditingRow(r.id)}
                    title="Editar fórmula"
                  >
                    {r.data.key}
                  </button>
                  <span className="ml-2 text-xs text-neutral-500">
                    {r.data.inTotal ? "[total]" : ""}
                  </span>
                </td>
                <td className="px-3 py-2">{previewValues[r.data.key] ?? "—"}</td>
              </tr>
            ))}
            {selected && (
              <tr className="border-t border-neutral-200 bg-neutral-50">
                <td className="px-3 py-2">
                  <input
                    className="border border-neutral-300 rounded-lg px-2 py-1 w-full"
                    placeholder="nombre_variable"
                    value={varName}
                    onChange={(e) => setVarName(snake(e.target.value))}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="border border-neutral-300 rounded-lg px-2 py-1 w-full"
                    placeholder="Ej: costo_rojo / costo_rosa"
                    value={expr}
                    onChange={(e) => setExpr(e.target.value)}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={inTotal} onChange={(e) => setInTotal(e.target.checked)} />
            Incluir esta fila en Total
          </label>

          <button
            className="px-3 py-2 rounded-lg bg-black text-white hover:opacity-90"
            onClick={async () => {
              const k = varName.trim();
              if (!k || !expr.trim()) return;
              const conflict = findConflicts(k, [
                { where: "tabla", has: false },
                { where: "cotizacion", has: false },
                { where: "calculadora", has: rows.some((r) => r.data.key === k) },
              ]);
              if (conflict) {
                alert(conflict);
                return;
              }
              await addDoc(collection(db, `${COL_CALCULATORS}/${selected}/rows`), {
                key: k,
                expr,
                inTotal,
                createdAt: serverTimestamp(),
              } as RowDoc);
              setVarName("");
              setExpr("");
              setInTotal(true);
            }}
          >
            + Agregar fila
          </button>
        </div>
      )}

      <div className="p-3 border border-neutral-200 rounded-xl bg-neutral-50">
        <div className="font-semibold">Subtotal (preview): MXN {subtotal.toFixed(2)}</div>
      </div>
    </div>
  );
}
