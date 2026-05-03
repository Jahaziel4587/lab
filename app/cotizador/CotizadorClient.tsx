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
  getDoc,
} from "firebase/firestore";
import { useAuth } from "@/src/Context/AuthContext";

type ViewKey = "cotizacion" | "calculadora" | "tabla" | "servicios";
type FieldType = "number" | "text" | "select" | "boolean" | "time" | "dimensions";

type ServiceField = {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
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
  key: string;
  value?: number | null;
  expr?: string;
  inTotal?: boolean;
  createdAt?: any;
};

type SettingsDoc = {
  currency: "MXN" | "USD";
  exchangeRate: number;
  iva: number;
};

const COL_SERVICES = "services";
const COL_COST_TABLES = "cost_tables";
const COL_CALCULATORS = "calculators";
const COL_SETTINGS = "cotizador_settings";

const parser = new Parser();

const inputClass =
  "mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder:text-white/35 outline-none focus:ring-2 focus:ring-emerald-400/25 focus:border-emerald-400/30";

const selectClass =
  "mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/25 focus:border-emerald-400/30 [&>option]:bg-white [&>option]:text-black [&>option]:font-bold";

const labelClass = "block text-sm font-medium text-white/75";

const primaryBtn =
  "inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-2.5 text-sm font-semibold text-black shadow-[0_18px_50px_-24px_rgba(45,212,191,0.75)] hover:brightness-110 hover:-translate-y-[1px] transition disabled:opacity-45 disabled:cursor-not-allowed";

const secondaryBtn =
  "inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white/85 hover:bg-white/[0.08] transition";

const dangerBtn =
  "inline-flex items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/15 transition";

function snake(s: string) {
  return s
    .normalize("NFD")
    // @ts-ignore
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_{2,}/g, "_");
}

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

async function ensureQuoteLiveDoc(pedidoId: string, settings: SettingsDoc | null) {
  const liveDocRef = doc(db, "pedidos", pedidoId, "quote_live", "live");
  const snap = await getDoc(liveDocRef);

  if (!snap.exists()) {
    await setDoc(liveDocRef, {
      currency: settings?.currency ?? "MXN",
      exchangeRate: settings?.exchangeRate ?? 17,
      ivaDefault: settings?.iva ?? 0.16,
      status: "open",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(liveDocRef, {
      currency: settings?.currency ?? "MXN",
      exchangeRate: settings?.exchangeRate ?? 17,
      ivaDefault: settings?.iva ?? 0.16,
      updatedAt: serverTimestamp(),
    });
  }

  return liveDocRef;
}

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
      snap.forEach((d: QueryDocumentSnapshot<T>) =>
        out.push({ id: d.id, data: d.data() as T })
      );
      setData(out);
    });

    return () => unsub();
  }, [parentPath, sub]);

  return data;
}

export default function CotizadorClient() {
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

  const menuItems: { key: ViewKey; label: string }[] = [
    { key: "cotizacion", label: "Cotización" },
    { key: "calculadora", label: "Calculadora" },
    { key: "tabla", label: "Tabla de costos" },
    { key: "servicios", label: "Servicios" },
  ];

  return (
    <div className="min-h-[calc(100vh-120px)] text-white">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">
            Cotizador
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Administra servicios, tablas de costos, calculadoras y cotizaciones vivas.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-5">
          <aside
            className={[
              "relative h-max lg:sticky lg:top-24 rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-2xl ring-1 ring-white/5 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.95)] overflow-hidden transition-all",
              collapsed ? "lg:w-20" : "lg:w-72",
            ].join(" ")}
            aria-label="Menú del cotizador"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-500/10 to-transparent" />

            <div className="relative p-4">
              <div className="flex items-center gap-3 mb-4">
                <button
                  aria-label="Alternar menú"
                  className="h-11 w-11 shrink-0 rounded-2xl border border-white/10 bg-white/[0.05] hover:bg-white/[0.08] transition flex items-center justify-center"
                  onClick={() => setCollapsed((v) => !v)}
                  title="Mostrar/ocultar menú"
                >
                  <div className="w-5 space-y-1">
                    <div className="h-0.5 bg-white/80" />
                    <div className="h-0.5 bg-white/80" />
                    <div className="h-0.5 bg-white/80" />
                  </div>
                </button>

                {!collapsed && (
                  <div>
                    <h2 className="text-lg font-semibold text-white">Panel</h2>
                    <p className="text-xs text-white/45">Módulos del cotizador</p>
                  </div>
                )}
              </div>

              <nav className="flex flex-col gap-2">
                {menuItems.map(({ key, label }) => {
                  const active = view === key;

                  return (
                    <button
                      key={key}
                      onClick={() => setView(key)}
                      title={label}
                      className={[
                        "group w-full px-3 py-3 rounded-2xl border transition flex items-center gap-3 text-sm",
                        active
                          ? "bg-emerald-400/90 text-black border-emerald-300/40 shadow-[0_18px_50px_-26px_rgba(45,212,191,0.8)]"
                          : "bg-white/[0.04] text-white/75 border-white/10 hover:bg-white/[0.08] hover:text-white",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "inline-block h-2.5 w-2.5 rounded-full",
                          active ? "bg-black" : "bg-emerald-300/70",
                        ].join(" ")}
                      />
                      {!collapsed && <span className="truncate font-medium">{label}</span>}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          <section className="relative flex-1 rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-2xl ring-1 ring-white/5 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.95)] overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-emerald-500/10 to-transparent" />

            <div className="relative p-5 sm:p-7">
              {view === "cotizacion" && <CotizacionPanel />}
              {view === "servicios" && <ServiciosPanel />}
              {view === "tabla" && <TablaCostosPanel />}
              {view === "calculadora" && <CalculadoraPanel />}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function CotizacionPanel() {
  const [settings, setSettings] = useState<SettingsDoc | null>(null);
  const { user } = useAuth?.() ?? { user: null };

  const search = useSearchParams();
  const proyectoParam = search.get("proyecto") || "";
  const tituloParam = search.get("titulo") || "";

  useEffect(() => {
    const ref = doc(db, COL_SETTINGS, "default");
    setDoc(ref, { currency: "MXN", exchangeRate: 17, iva: 0.16 }, { merge: true });

    const unsub = onSnapshot(ref, (snap) => {
      const data = (snap.data() || {
        currency: "MXN",
        exchangeRate: 17,
        iva: 0.16,
      }) as SettingsDoc;

      setSettings(data);
    });

    return () => unsub();
  }, []);

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

  useEffect(() => {
    if (!project && proyectoParam) setProject(proyectoParam);
  }, [project, proyectoParam]);

  const [pedidoId, setPedidoId] = useState<string>("");

  useEffect(() => {
    if (!pedidoId && tituloParam && pedidos.length) {
      const found =
        pedidos.find((p) => {
          const projName = p.data.proyecto || p.data.titulo || "Sin nombre";
          return p.data.titulo === tituloParam && (!proyectoParam || projName === proyectoParam);
        }) || pedidos.find((p) => p.data.titulo === tituloParam);

      if (found) setPedidoId(found.id);
    }
  }, [pedidoId, tituloParam, proyectoParam, pedidos]);

  const services = useColl<ServiceDoc>(COL_SERVICES);
  const [serviceId, setServiceId] = useState<string>("");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [selects, setSelects] = useState<Record<string, string>>({});

  const selService = services.find((s) => s.id === serviceId)?.data;

  const costTablesGroups = useColl<GroupDoc>(COL_COST_TABLES);
  const [selectedCostGroup, setSelectedCostGroup] = useState<string>("");

  const costRows = useSubColl<RowDoc>(
    selectedCostGroup ? `${COL_COST_TABLES}/${selectedCostGroup}` : "",
    "rows"
  );

  const costVars = useMemo(() => {
    const out: Record<string, number> = {};
    costRows.forEach((r) => {
      if (r.data.key && typeof r.data.value === "number") out[r.data.key] = r.data.value;
    });
    return out;
  }, [costRows]);

  const calcGroups = useColl<GroupDoc>(COL_CALCULATORS);
  const [activeCalcGroup, setActiveCalcGroup] = useState<string>("");

  const calcRows = useSubColl<RowDoc>(
    activeCalcGroup ? `${COL_CALCULATORS}/${activeCalcGroup}` : "",
    "rows"
  );

  const [isAttaching, setIsAttaching] = useState(false);

  useEffect(() => {
    if (!serviceId) return;

    const svc = services.find((s) => s.id === serviceId)?.data;
    if (!svc) return;

    const costMatch = costTablesGroups.find((g) => g.data.name === svc.name);
    if (costMatch && costMatch.id !== selectedCostGroup) {
      setSelectedCostGroup(costMatch.id);
    }

    const calcMatch = calcGroups.find((g) => g.data.name === svc.name);
    if (calcMatch && calcMatch.id !== activeCalcGroup) {
      setActiveCalcGroup(calcMatch.id);
    }
  }, [
    serviceId,
    services,
    costTablesGroups,
    calcGroups,
    selectedCostGroup,
    activeCalcGroup,
  ]);

  const resolvedCalc = useMemo(() => {
    const result: Record<string, number> = {};

    for (let pass = 0; pass < 6; pass++) {
      let progress = false;

      calcRows.forEach((r) => {
        if (!r.data.key || !r.data.expr) return;
        if (result[r.data.key] !== undefined) return;

        const ctx = buildContext(costVars, answers, result);
        const v = safeEval(r.data.expr, ctx);

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
    <div className="space-y-6">
      <PanelHeader
        title="Cotización"
        description="Selecciona un pedido, configura el servicio y adjúntalo a la cotización viva."
      />

      <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
        <h4 className="text-base font-semibold text-white">Configuración general</h4>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Moneda</label>
            <select
              className={selectClass}
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
            <label className={labelClass}>Tasa USD → MXN</label>
            <input
              type="number"
              step="1"
              className={inputClass}
              value={rate}
              onChange={async (e) => {
                const v = parseFloat(e.target.value) || 0;
                await setDoc(
                  doc(db, COL_SETTINGS, "default"),
                  { exchangeRate: v },
                  { merge: true }
                );
              }}
            />
          </div>

          <div>
            <label className={labelClass}>IVA</label>
            <input
              type="number"
              step="1"
              className={inputClass}
              value={settings?.iva ?? 0.16}
              onChange={async (e) => {
                const v = parseFloat(e.target.value) || 0;
                await setDoc(doc(db, COL_SETTINGS, "default"), { iva: v }, { merge: true });
              }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
        <h4 className="text-base font-semibold text-white">Datos de la cotización</h4>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>1) Proyecto a cotizar</label>
            <select
              className={selectClass}
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

          <div>
            <label className={labelClass}>2) Pedido del proyecto</label>
            <select
              className={selectClass}
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

          <div>
            <label className={labelClass}>3) Servicio</label>
            <select
              className={selectClass}
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
        </div>
      </div>

      {selService && (
        <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
          <h4 className="text-base font-semibold text-white">Parámetros del servicio</h4>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {selService.fields.map((f) =>
              f.type === "select" ? (
                <ServiceSelectInput
                  key={f.key}
                  field={f}
                  value={selects[f.key]}
                  onChange={(val) => {
                    setSelects((s) => ({ ...s, [f.key]: val }));

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
              ) : f.type === "text" ? (
                <ServiceTextInput
                  key={f.key}
                  field={f}
                  value={selects[f.key]}
                  onChange={(val) => setSelects((s) => ({ ...s, [f.key]: val }))}
                />
              ) : (
                <ServiceFieldInput
                  key={f.key}
                  field={f}
                  value={answers[f.key]}
                  onChange={(val) => {
                    if (val === null) {
                      setAnswers(({ [f.key]: _omit, ...rest }) => rest);
                      return;
                    }

                    const conflict = findConflicts(f.key, [
                      { where: "tabla", has: f.key in Object(costVars) },
                      { where: "cotizacion", has: f.key in answers },
                      { where: "calculadora", has: false },
                    ]);

                    if (conflict && !(f.key in answers)) alert(conflict);

                    setAnswers((a) => ({ ...a, [f.key]: val }));
                  }}
                />
              )
            )}
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
        <p className="text-sm text-white/55">Total estimado</p>
        <div className="mt-1 text-2xl font-semibold text-white">
          {currency} {displayTotal.toFixed(2)}
        </div>
        <p className="mt-2 text-sm text-white/50">
          Suma de filas marcadas como <span className="text-white/70">inTotal</span> en la
          calculadora vinculada al servicio.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          className={primaryBtn}
          disabled={!pedidoId || !serviceId || isAttaching}
          onClick={async () => {
            if (isAttaching) return;
            if (!pedidoId || !serviceId || !selService) return;

            try {
              setIsAttaching(true);

              await ensureQuoteLiveDoc(pedidoId, settings);

              const serviceName = selService.name;
              const calcGroupName =
                calcGroups.find((g) => g.id === activeCalcGroup)?.data?.name || "";
              const costGroupName =
                costTablesGroups.find((g) => g.id === selectedCostGroup)?.data?.name || "";

              await addDoc(
                collection(db, "pedidos", pedidoId, "quote_live", "live", "lines"),
                {
                  serviceId,
                  serviceName,
                  calcGroupId: activeCalcGroup || null,
                  calcGroupName,
                  costGroupId: selectedCostGroup || null,
                  costGroupName,
                  answers,
                  selects,
                  resolvedCalc,
                  subtotalMXN: total,
                  displayCurrency: settings?.currency ?? "MXN",
                  displayTotal,
                  createdBy: user?.uid || null,
                  createdAt: serverTimestamp(),
                }
              );

              setServiceId("");
              setAnswers({});
              setSelects({});
              setSelectedCostGroup("");
              setActiveCalcGroup("");

              alert("Servicio agregado a la Cotización Viva del pedido.");
            } finally {
              setIsAttaching(false);
            }
          }}
        >
          {isAttaching ? "Adjuntando..." : "Adjuntar servicio a la cotización"}
        </button>
      </div>
    </div>
  );
}

function PanelHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-xl sm:text-2xl font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-white/60 max-w-3xl">{description}</p>
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
  return (
    <div>
      <label className={labelClass}>
        {field.label} <span className="text-white/35">({field.key})</span>
      </label>
      <select className={selectClass} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Selecciona —</option>
        {(field.options || []).map((o, i) => (
          <option key={i} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function ServiceTextInput({
  field,
  value,
  onChange,
}: {
  field: ServiceField;
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className={labelClass}>
        {field.label} <span className="text-white/35">({field.key})</span>
      </label>
      <input
        type="text"
        className={inputClass}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
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
      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked ? 1 : 0)}
          className="accent-emerald-400"
        />
        {field.label}
      </label>
    );
  }

  return (
    <div>
      <label className={labelClass}>
        {field.label} <span className="text-white/35">({field.key})</span>
      </label>
      <input
        type="number"
        step="1"
        className={inputClass}
        value={value === undefined ? "" : value}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") onChange(null);
          else {
            const num = Number(raw);
            if (!Number.isNaN(num)) onChange(num);
          }
        }}
        placeholder="0"
      />
    </div>
  );
}

function ServiciosPanel() {
  const services = useColl<ServiceDoc>(COL_SERVICES);

  const [name, setName] = useState("");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("number");
  const [newFieldOptions, setNewFieldOptions] = useState("");

  return (
    <div className="space-y-6">
      <PanelHeader
        title="Servicios"
        description="Crea servicios y define los campos que después se usarán en la cotización."
      />

      <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <label className={labelClass}>Nuevo servicio</label>
            <input
              className={inputClass}
              placeholder="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <button
            className={primaryBtn}
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
      </div>

      <div className="grid gap-5">
        {services.map((s) => (
          <div
            key={s.id}
            className="rounded-3xl border border-white/10 bg-black/30 p-5 hover:bg-white/[0.04] transition"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-lg font-semibold text-white">{s.data.name}</h4>
                <p className="text-sm text-white/45">
                  {s.data.fields?.length || 0} campos configurados
                </p>
              </div>

              <button
                className={dangerBtn}
                onClick={async () => {
                  await deleteDoc(doc(db, COL_SERVICES, s.id));
                }}
              >
                Eliminar
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {s.data.fields?.length ? (
                s.data.fields.map((f, idx) => (
                  <div
                    key={idx}
                    className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm text-white/75"
                  >
                    {f.label}
                    <span className="ml-2 text-white/35">({f.key})</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/45">Este servicio aún no tiene campos.</p>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_180px_1fr_auto] gap-3 items-end">
              <div>
                <label className={labelClass}>Nuevo campo</label>
                <input
                  className={inputClass}
                  placeholder="Etiqueta"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                />
              </div>

              <div>
                <label className={labelClass}>Tipo</label>
                <select
                  className={selectClass}
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

              <div>
                <label className={labelClass}>Opciones</label>
                <input
                  disabled={newFieldType !== "select"}
                  className={`${inputClass} disabled:opacity-40`}
                  placeholder="Ej: PLA, ABS, PETG"
                  value={newFieldOptions}
                  onChange={(e) => setNewFieldOptions(e.target.value)}
                />
              </div>

              <button
                className={secondaryBtn}
                onClick={async () => {
                  const lab = newFieldLabel.trim();
                  if (!lab) return;

                  const key = snake(lab);
                  const payload: ServiceField = {
                    key,
                    label: lab,
                    type: newFieldType,
                  };

                  if (newFieldType === "select") {
                    const opts = newFieldOptions
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean);

                    payload.options = opts;
                  }

                  const updated = [...(s.data.fields || []), payload];

                  await updateDoc(doc(db, COL_SERVICES, s.id), {
                    fields: updated,
                  });

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

function TablaCostosPanel() {
  const groups = useColl<GroupDoc>(COL_COST_TABLES);
  const [selected, setSelected] = useState<string>("");
  const rows = useSubColl<RowDoc>(selected ? `${COL_COST_TABLES}/${selected}` : "", "rows");

  const [groupName, setGroupName] = useState("");
  const [varName, setVarName] = useState("");
  const [varValue, setVarValue] = useState<number | "">("");

  return (
    <div className="space-y-6">
      <PanelHeader
        title="Tabla de costos"
        description="Crea subcategorías y variables de costo fijo en MXN."
      />

      <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <label className={labelClass}>Nueva subcategoría</label>
            <input
              className={inputClass}
              placeholder="Nombre"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          <button
            className={primaryBtn}
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
      </div>

      <div>
        <label className={labelClass}>Subcategoría</label>
        <select className={selectClass} value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">— Selecciona —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.data.name}
            </option>
          ))}
        </select>
      </div>

      <DarkTable
        headers={["Variable", "Valor (MXN)"]}
        rows={rows.map((r) => [r.data.key, r.data.value ?? "—"])}
        footer={
          selected ? (
            <>
              <td className="px-4 py-3">
                <input
                  className={inputClass}
                  placeholder="nombre_variable"
                  value={varName}
                  onChange={(e) => setVarName(snake(e.target.value))}
                />
              </td>
              <td className="px-4 py-3">
                <input
                  type="number"
                  step="1"
                  className={inputClass}
                  placeholder="0"
                  value={varValue}
                  onChange={(e) =>
                    setVarValue(e.target.value === "" ? "" : parseFloat(e.target.value))
                  }
                />
              </td>
            </>
          ) : null
        }
      />

      {selected && (
        <button
          className={primaryBtn}
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
      )}
    </div>
  );
}

function CalculadoraPanel() {
  const groups = useColl<GroupDoc>(COL_CALCULATORS);
  const [selected, setSelected] = useState<string>("");
  const rows = useSubColl<RowDoc>(selected ? `${COL_CALCULATORS}/${selected}` : "", "rows");

  const allCostGroups = useColl<GroupDoc>(COL_COST_TABLES);
  const [costGroupForPreview, setCostGroupForPreview] = useState<string>("");

  const costRows = useSubColl<RowDoc>(
    costGroupForPreview ? `${COL_COST_TABLES}/${costGroupForPreview}` : "",
    "rows"
  );

  const costVars = useMemo(() => {
    const out: Record<string, number> = {};
    costRows.forEach((r) => {
      if (r.data.key && typeof r.data.value === "number") out[r.data.key] = r.data.value;
    });
    return out;
  }, [costRows]);

  const [groupName, setGroupName] = useState("");
  const [varName, setVarName] = useState("");
  const [expr, setExpr] = useState("");
  const [inTotal, setInTotal] = useState(true);

  const [editingRow, setEditingRow] = useState<string | null>(null);
  const currentRow = rows.find((r) => r.id === editingRow);

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
    <div className="space-y-6">
      <PanelHeader
        title="Calculadora"
        description="Crea fórmulas por subcategoría y define qué variables entran al total."
      />

      <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <label className={labelClass}>Nueva subcategoría</label>
            <input
              className={inputClass}
              placeholder="Nombre"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          <button
            className={primaryBtn}
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Subcategoría</label>
          <select className={selectClass} value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">— Selecciona —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.data.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Tabla de costos (preview)</label>
          <select
            className={selectClass}
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
      </div>

      {editingRow && (
        <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
          <label className={labelClass}>Barra de fórmula</label>
          <input
            className={inputClass}
            placeholder="Ej: costo_material + tiempo_pre * tarifa_hora"
            value={currentRow?.data.expr ?? ""}
            onChange={async (e) => {
              const v = e.target.value;

              await updateDoc(doc(db, `${COL_CALCULATORS}/${selected}/rows`, editingRow), {
                expr: v,
              });
            }}
          />
        </div>
      )}

      <DarkTable
        headers={["Variable", "Valor (preview)"]}
        rows={rows.map((r) => [
          <button
            key={r.id}
            className="text-emerald-300 hover:text-emerald-200 underline underline-offset-4"
            onClick={() => setEditingRow(r.id)}
            title="Editar fórmula"
          >
            {r.data.key}
            {r.data.inTotal ? <span className="ml-2 text-xs text-white/45">[total]</span> : null}
          </button>,
          previewValues[r.data.key] ?? "—",
        ])}
        footer={
          selected ? (
            <>
              <td className="px-4 py-3">
                <input
                  className={inputClass}
                  placeholder="nombre_variable"
                  value={varName}
                  onChange={(e) => setVarName(snake(e.target.value))}
                />
              </td>
              <td className="px-4 py-3">
                <input
                  className={inputClass}
                  placeholder="Ej: costo_rojo / costo_rosa"
                  value={expr}
                  onChange={(e) => setExpr(e.target.value)}
                />
              </td>
            </>
          ) : null
        }
      />

      {selected && (
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
            <input
              type="checkbox"
              checked={inTotal}
              onChange={(e) => setInTotal(e.target.checked)}
              className="accent-emerald-400"
            />
            Incluir esta fila en Total
          </label>

          <button
            className={primaryBtn}
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

      <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
        <p className="text-sm text-white/55">Subtotal preview</p>
        <div className="mt-1 text-2xl font-semibold text-white">
          MXN {subtotal.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

function DarkTable({
  headers,
  rows,
  footer,
}: {
  headers: string[];
  rows: any[][];
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-2xl ring-1 ring-white/5 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.95)] overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-emerald-500/10 to-transparent" />

      <table className="relative w-full text-sm table-fixed">
        <thead className="bg-white/[0.02]">
          <tr className="text-left text-[12px] tracking-wide text-white/55">
            {headers.map((h) => (
              <th key={h} className="py-3 px-4 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-white/10">
          {rows.map((row, idx) => (
            <tr key={idx} className="hover:bg-emerald-500/[0.04] transition">
              {row.map((cell, i) => (
                <td key={i} className="px-4 py-3 text-white/80 break-words">
                  {cell}
                </td>
              ))}
            </tr>
          ))}

          {rows.length === 0 && !footer && (
            <tr>
              <td className="px-4 py-10 text-center text-white/45" colSpan={headers.length}>
                No hay registros todavía.
              </td>
            </tr>
          )}

          {footer && (
            <tr className="bg-white/[0.025] hover:bg-emerald-500/[0.04] transition">
              {footer}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}