"use client";

import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AdamAssistant from "@/app/components/AdamAssistant";
import PrototipadoFullModal from "@/app/components/PrototipadoFullModal";

type Step = {
  id: string;
  title: string;
  hover: string;
  details: string[];
  question: string;
  stepdown: string;
};

type Node = {
  id: Step["id"];
  label: string;
  x: number; // %
  y: number; // %
  color: string;
};

type Edge = {
  from: Step["id"];
  to: Step["id"];
  kind: "forward" | "stepdown";
};

// ✅ Proceso Bioana (roles)
type TeamRole = {
  team: string;
  responsibilities: string[];
};

type ProcessPhase = {
  id: Step["id"];
  label: string;
  uncertainty: {
    level: "Muy alta" | "Alta" | "Media" | "Baja" | "Mínima";
    note: string;
  };
  objective: string;
  primaryQuestion: string;
  teams: TeamRole[];
  activities: string[];
  deliverables: string[];
  decisions: string[];
  stepdowns: string[];
};

// =========================
// ✅ Diagnóstico (nuevo)
// =========================
type Answer = "yes" | "partial" | "no" | "na";

type AxisId =
  | "principio"
  | "integracion"
  | "repetibilidad"
  | "manufactura"
  | "control";

type ProjectType = "dispositivo" | "fixture" | "proceso" | "software" | "consumible";

type Q = {
  id: string;
  axis: AxisId;
  text: string;
  help?: string;
  weight: number; // 1-3 base
  hardGate?: {
    // si se contesta "no" aquí, se recomienda stepdown (hard)
    message: string;
  };
};

function scoreAnswer(a: Answer) {
  if (a === "yes") return 1.0;
  if (a === "partial") return 0.5;
  if (a === "no") return 0.0;
  return null; // N/A
}

function axisLabel(a: AxisId) {
  switch (a) {
    case "principio":
      return "Principio fundamental";
    case "integracion":
      return "Integración / arquitectura";
    case "repetibilidad":
      return "Repetibilidad / robustez";
    case "manufactura":
      return "Manufacturabilidad";
    case "control":
      return "Control / documentación";
  }
}

function projectTypeLabel(t: ProjectType) {
  switch (t) {
    case "dispositivo":
      return "Dispositivo (hardware)";
    case "fixture":
      return "Fixture / herramienta";
    case "proceso":
      return "Proceso / método";
    case "software":
      return "Software / automatización";
    case "consumible":
      return "Consumible";
  }
}

function phaseLabel(p: string) {
  if (p === "poc") return "PoC";
  if (p === "alpha") return "Alpha";
  if (p === "beta") return "Beta";
  if (p === "preval") return "Pre-validación";
  return "Design Controls";
}

function badgeColorByPhase(p: string) {
  if (p === "poc") return "bg-rose-500/15 text-rose-200 border-rose-400/20";
  if (p === "alpha") return "bg-amber-500/15 text-amber-200 border-amber-400/20";
  if (p === "beta") return "bg-yellow-500/10 text-yellow-200 border-yellow-400/20";
  if (p === "preval") return "bg-emerald-500/15 text-emerald-200 border-emerald-400/20";
  return "bg-indigo-500/15 text-indigo-200 border-indigo-400/20";
}

function confidenceFromCompleteness(
  totalAnswered: number,
  totalQs: number,
  contradictions: number
) {
  const ratio = totalAnswered / Math.max(1, totalQs);
  if (ratio < 0.55) return "Baja";
  if (contradictions >= 2) return "Baja";
  if (ratio < 0.8 || contradictions === 1) return "Media";
  return "Alta";
}

// Ajuste de pesos por tipo de proyecto (lo “último” que te dije)
function applyProjectTypeWeights(
  base: Record<AxisId, number>,
  type: ProjectType
): Record<AxisId, number> {
  // multiplicadores por eje
  const m: Record<ProjectType, Record<AxisId, number>> = {
    dispositivo: {
      principio: 1.0,
      integracion: 1.0,
      repetibilidad: 1.0,
      manufactura: 1.0,
      control: 1.0,
    },
    fixture: {
      principio: 0.9,
      integracion: 1.0,
      repetibilidad: 1.0,
      manufactura: 1.25, // más importante más temprano
      control: 0.95,
    },
    proceso: {
      principio: 0.9,
      integracion: 0.95,
      repetibilidad: 1.2, // consistencia del método
      manufactura: 1.15,
      control: 1.05,
    },
    software: {
      principio: 0.95,
      integracion: 1.1, // integración con flujos/sistemas
      repetibilidad: 1.15,
      manufactura: 0.75, // manufactura no aplica mucho
      control: 1.15,
    },
    consumible: {
      principio: 1.0,
      integracion: 0.85,
      repetibilidad: 1.1,
      manufactura: 1.2,
      control: 1.05,
    },
  };

  const mm = m[type];
  return {
    principio: Math.round(base.principio * mm.principio),
    integracion: Math.round(base.integracion * mm.integracion),
    repetibilidad: Math.round(base.repetibilidad * mm.repetibilidad),
    manufactura: Math.round(base.manufactura * mm.manufactura),
    control: Math.round(base.control * mm.control),
  };
}

function phaseFromScores(s: Record<AxisId, number>) {
  // Heurística simple y estable para “proyectos únicos”
  const P = s.principio;
  const I = s.integracion;
  const R = s.repetibilidad;
  const M = s.manufactura;
  const C = s.control;

  if (P < 45) return "poc";
  if (P >= 45 && I < 55) return "alpha";
  if (P >= 45 && I >= 55 && R < 55) return "alpha";
  if (P >= 65 && I >= 60 && R >= 55 && M < 60) return "beta";
  if (P >= 70 && I >= 65 && R >= 65 && M >= 55 && C < 60) return "preval";
  if (P >= 75 && I >= 70 && R >= 70 && M >= 70 && C >= 60) return "transfer";

  if (R >= 60 && M >= 55) return "preval";
  if (R >= 55) return "beta";
  return "alpha";
}

function DiagnosticoFase() {
  const questions: Q[] = useMemo(
    () => [
      // A) PRINCIPIO
      {
        id: "p1",
        axis: "principio",
        text: "¿Existe evidencia física de que el principio fundamental funciona (no solo teoría)?",
        help: "Ej.: medición, video, test en banco, datos, etc.",
        weight: 3,
        hardGate: {
          message: "Sin evidencia física del principio, el proyecto no debe clasificarse por encima de PoC.",
        },
      },
      {
        id: "p2",
        axis: "principio",
        text: "¿El resultado se ha repetido al menos 3 veces con resultados similares?",
        weight: 2,
      },
      {
        id: "p3",
        axis: "principio",
        text: "¿Se identificaron variables críticas (qué cambia el resultado) y rangos aproximados?",
        weight: 2,
      },
      {
        id: "p4",
        axis: "principio",
        text: "¿Cumple el criterio mínimo de éxito (aunque sea con montaje simple)?",
        weight: 2,
      },

      // B) INTEGRACIÓN
      {
        id: "i1",
        axis: "integracion",
        text: "¿Ya existe un sistema integrado (no solo piezas aisladas)?",
        weight: 3,
      },
      {
        id: "i2",
        axis: "integracion",
        text: "¿Puede completar un ciclo de uso básico de inicio a fin (aunque sea tosco)?",
        weight: 2,
      },
      {
        id: "i3",
        axis: "integracion",
        text: "¿Las interfaces y el ensamble ya se validaron (encaje/ajuste/operación básica)?",
        weight: 2,
      },
      {
        id: "i4",
        axis: "integracion",
        text: "¿La arquitectura del sistema está estable y los cambios mayores ya NO son comunes?",
        weight: 2,
      },

      // C) REPETIBILIDAD
      {
        id: "r1",
        axis: "repetibilidad",
        text: "¿Funciona consistentemente en condiciones representativas de uso?",
        weight: 3,
        hardGate: {
          message: "Si aún no funciona en condiciones representativas, Beta/Pre-validación puede ser prematuro.",
        },
      },
      {
        id: "r2",
        axis: "repetibilidad",
        text: "¿Se han hecho pruebas repetidas (≥5) sin fallas críticas?",
        weight: 2,
      },
      {
        id: "r3",
        axis: "repetibilidad",
        text: "¿Materiales cercanos a finales o equivalentes funcionales ya se están usando?",
        weight: 2,
      },
      {
        id: "r4",
        axis: "repetibilidad",
        text: "¿Tolerancias críticas y puntos sensibles de variación ya están identificados?",
        weight: 2,
      },
      {
        id: "r5",
        axis: "repetibilidad",
        text: "¿Se han listado riesgos preliminares (top 5 fallas) y mitigaciones?",
        weight: 2,
      },

      // D) MANUFACTURA
      {
        id: "m1",
        axis: "manufactura",
        text: "¿Existe un método de fabricación y ensamble propuesto (pasos claros)?",
        weight: 3,
      },
      {
        id: "m2",
        axis: "manufactura",
        text: "¿Se han diseñado/probado fixtures o herramientas para ensamblar/repetir el proceso?",
        weight: 2,
      },
      {
        id: "m3",
        axis: "manufactura",
        text: "¿Se hicieron corridas repetidas de fabricación/ensamble con resultados similares?",
        weight: 2,
      },
      {
        id: "m4",
        axis: "manufactura",
        text: "¿Se identificaron limitantes de capacidad, materiales o procesos internos?",
        weight: 2,
      },

      // E) CONTROL
      {
        id: "c1",
        axis: "control",
        text: "¿Cambios se gestionan con una evaluación de impacto (qué afecta y por qué)?",
        weight: 3,
      },
      {
        id: "c2",
        axis: "control",
        text: "¿Pruebas y resultados quedan documentados y trazables (aunque sea simple)?",
        weight: 2,
      },
      {
        id: "c3",
        axis: "control",
        text: "¿Requisitos finales y plan de verificación/validación están definidos?",
        weight: 2,
      },
    ],
    []
  );

  const [projectType, setProjectType] = useState<ProjectType>("dispositivo");

  const [answers, setAnswers] = useState<Record<string, Answer>>(() => {
    const init: Record<string, Answer> = {};
    questions.forEach((q) => (init[q.id] = "na"));
    return init;
  });

  const [showResult, setShowResult] = useState(false);

  const grouped = useMemo(() => {
    const g: Record<AxisId, Q[]> = {
      principio: [],
      integracion: [],
      repetibilidad: [],
      manufactura: [],
      control: [],
    };
    questions.forEach((q) => g[q.axis].push(q));
    return g;
  }, [questions]);

  const computed = useMemo(() => {
    // score por eje (0..100) usando pesos y excluyendo N/A
    const axisRaw: Record<AxisId, number> = {
      principio: 0,
      integracion: 0,
      repetibilidad: 0,
      manufactura: 0,
      control: 0,
    };
    const axisDen: Record<AxisId, number> = {
      principio: 0,
      integracion: 0,
      repetibilidad: 0,
      manufactura: 0,
      control: 0,
    };

    let answeredCount = 0;
    let contradictions = 0;
    const hardGates: string[] = [];

    questions.forEach((q) => {
      const a = answers[q.id] ?? "na";
      const v = scoreAnswer(a);
      if (v === null) return; // N/A
      answeredCount += 1;

      axisRaw[q.axis] += v * q.weight;
      axisDen[q.axis] += 1 * q.weight;

      if (q.hardGate && a === "no") {
        hardGates.push(q.hardGate.message);
      }
    });

    // normaliza a 0..100
    const axisScoreBase: Record<AxisId, number> = {
      principio: axisDen.principio > 0 ? Math.round((axisRaw.principio / axisDen.principio) * 100) : 0,
      integracion: axisDen.integracion > 0 ? Math.round((axisRaw.integracion / axisDen.integracion) * 100) : 0,
      repetibilidad:
        axisDen.repetibilidad > 0
          ? Math.round((axisRaw.repetibilidad / axisDen.repetibilidad) * 100)
          : 0,
      manufactura:
        axisDen.manufactura > 0 ? Math.round((axisRaw.manufactura / axisDen.manufactura) * 100) : 0,
      control: axisDen.control > 0 ? Math.round((axisRaw.control / axisDen.control) * 100) : 0,
    };

    // ✅ ajuste por tipo de proyecto (solo pondera; no cambia las preguntas)
    const axisScore = applyProjectTypeWeights(axisScoreBase, projectType);

    const suggested = phaseFromScores(axisScore);

    // contradicciones típicas (para recomendar stepdown)
    const phaseRank = { poc: 0, alpha: 1, beta: 2, preval: 3, transfer: 4 } as const;
    const rank = phaseRank[suggested as keyof typeof phaseRank] ?? 0;

    if (rank >= 2 && axisScore.principio < 55) contradictions++;
    if (rank >= 2 && axisScore.integracion < 55) contradictions++;
    if (rank >= 3 && axisScore.manufactura < 55) contradictions++;
    if (rank >= 4 && axisScore.control < 60) contradictions++;

    const confidence = confidenceFromCompleteness(
      answeredCount,
      questions.length,
      contradictions
    );

    // stepdown recomendado
    let stepdown: null | { to: string; why: string[] } = null;

    if (hardGates.length) {
      const to = axisScore.principio < 45 ? "poc" : "alpha";
      stepdown = { to, why: hardGates };
    } else {
      const why: string[] = [];
      if (suggested === "preval" && axisScore.manufactura < 60) {
        why.push("Manufacturabilidad aún no es consistente (fixtures/proceso/corridas).");
      }
      if ((suggested === "preval" || suggested === "transfer") && axisScore.repetibilidad < 65) {
        why.push("Repetibilidad bajo condiciones representativas aún es insuficiente.");
      }
      if (suggested === "beta" && axisScore.integracion < 60) {
        why.push("Integración/arquitectura todavía cambia demasiado (más propio de Alpha).");
      }
      if (suggested === "transfer" && axisScore.control < 65) {
        why.push("Falta control formal suficiente (cambios/documentación/trazabilidad).");
      }

      if (why.length) {
        const to =
          suggested === "transfer"
            ? "preval"
            : suggested === "preval"
              ? "beta"
              : suggested === "beta"
                ? "alpha"
                : "poc";
        stepdown = { to, why };
      }
    }

    // razones principales (top 3 ejes fuertes + top 2 débiles)
    const axisPairs = (Object.keys(axisScore) as AxisId[]).map((k) => ({
      axis: k,
      v: axisScore[k],
    }));
    const top = [...axisPairs].sort((a, b) => b.v - a.v).slice(0, 3);
    const low = [...axisPairs].sort((a, b) => a.v - b.v).slice(0, 2);

    return {
      axisScore,
      axisScoreBase,
      suggested,
      confidence,
      contradictions,
      answeredCount,
      hardGates,
      stepdown,
      top,
      low,
    };
  }, [answers, questions, projectType]);

  const setA = (qid: string, a: Answer) => {
    setAnswers((p) => ({ ...p, [qid]: a }));
  };

  const reset = () => {
    const init: Record<string, Answer> = {};
    questions.forEach((q) => (init[q.id] = "na"));
    setAnswers(init);
    setShowResult(false);
  };

  const AnswerBtn = ({
    qid,
    value,
    label,
  }: {
    qid: string;
    value: Answer;
    label: string;
  }) => {
    const active = answers[qid] === value;
    return (
      <button
        type="button"
        onClick={() => setA(qid, value)}
        className={[
          "px-3 py-1.5 rounded-xl text-xs border transition",
          active
            ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/25"
            : "bg-white/5 text-gray-300 border-white/10 hover:border-emerald-400/20",
        ].join(" ")}
      >
        {label}
      </button>
    );
  };

  const AxisBlock = ({ axis }: { axis: AxisId }) => {
    const qs = grouped[axis];
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">{axisLabel(axis)}</p>
            <p className="text-xs text-gray-400 mt-1">
              Score:{" "}
              <span className="text-gray-200 font-semibold">
                {computed.axisScore[axis]}%
              </span>
              <span className="text-gray-500">
                {" "}
                (base {computed.axisScoreBase[axis]}%)
              </span>
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {qs.map((q) => (
            <div
              key={q.id}
              className="rounded-xl border border-white/10 bg-black/20 p-4"
            >
              <p className="text-sm text-gray-100">{q.text}</p>
              {q.help && <p className="mt-1 text-xs text-gray-400">{q.help}</p>}

              <div className="mt-3 flex flex-wrap gap-2">
                <AnswerBtn qid={q.id} value="yes" label="Sí" />
                <AnswerBtn qid={q.id} value="partial" label="Parcial" />
                <AnswerBtn qid={q.id} value="no" label="No" />
                <AnswerBtn qid={q.id} value="na" label="N/A" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-white">Diagnóstico de fase</h2>
      <p className="mt-2 text-gray-300 max-w-3xl">
        Responde con evidencia disponible. El sistema sugiere la fase actual, el
        nivel de confianza y si conviene un retroceso (stepdown) por riesgos o
        contradicciones.
      </p>

      {/* ✅ selector de tipo de proyecto */}
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-semibold text-white">Tipo de proyecto</p>
        <p className="mt-1 text-xs text-gray-400">
          Ajusta ponderaciones (sin cambiar las preguntas). Ej.: fixtures priorizan manufacturabilidad antes.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              "dispositivo",
              "fixture",
              "proceso",
              "software",
              "consumible",
            ] as ProjectType[]
          ).map((t) => {
            const active = projectType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setProjectType(t)}
                className={[
                  "px-3 py-2 rounded-xl text-sm border transition",
                  active
                    ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/25"
                    : "bg-white/5 text-gray-300 border-white/10 hover:border-emerald-400/20",
                ].join(" ")}
              >
                {projectTypeLabel(t)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AxisBlock axis="principio" />
        <AxisBlock axis="integracion" />
        <AxisBlock axis="repetibilidad" />
        <AxisBlock axis="manufactura" />
        <div className="lg:col-span-2">
          <AxisBlock axis="control" />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setShowResult(true)}
          className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-200 border border-emerald-400/20 hover:bg-emerald-500/25 transition text-sm"
        >
          Calcular fase
        </button>
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-xl bg-white/5 text-gray-300 border border-white/10 hover:border-white/20 transition text-sm"
        >
          Reiniciar
        </button>
      </div>

      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="mt-6 rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-gray-400">Fase sugerida</p>
                <p className="text-lg font-semibold text-white">
                  {phaseLabel(computed.suggested)}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Tipo: <span className="text-gray-200">{projectTypeLabel(projectType)}</span>
                </p>
              </div>

              <span
                className={[
                  "inline-flex items-center px-3 py-1 rounded-xl text-xs border",
                  badgeColorByPhase(computed.suggested),
                ].join(" ")}
              >
                Confianza: {computed.confidence}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">Evidencia fuerte</p>
                <ul className="mt-2 list-disc list-inside text-sm text-gray-300 space-y-1">
                  {computed.top.map((t) => (
                    <li key={t.axis}>
                      {axisLabel(t.axis)}:{" "}
                      <span className="text-gray-100 font-semibold">{t.v}%</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">Riesgo / gaps</p>
                <ul className="mt-2 list-disc list-inside text-sm text-gray-300 space-y-1">
                  {computed.low.map((t) => (
                    <li key={t.axis}>
                      {axisLabel(t.axis)}:{" "}
                      <span className="text-gray-100 font-semibold">{t.v}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {computed.stepdown && (
              <div className="mt-4 rounded-xl border border-rose-400/15 bg-rose-500/5 p-4">
                <p className="text-sm font-semibold text-rose-200">
                  Recomendación: Stepdown a {phaseLabel(computed.stepdown.to)}
                </p>
                <ul className="mt-2 list-disc list-inside text-sm text-gray-300 space-y-1">
                  {computed.stepdown.why.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-4 text-xs text-gray-400">
              Respondidas: {computed.answeredCount}/{questions.length} • Contradicciones detectadas:{" "}
              {computed.contradictions}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PrototipadoPage() {
  const [tab, setTab] = useState<"que" | "proceso" | "diagnostico">("que");

  const [hoverId, setHoverId] = useState<Step["id"] | null>(null);
  const [selectedId, setSelectedId] = useState<Step["id"] | null>(null);

  // Anchor en viewport (fixed)
  const [anchor, setAnchor] = useState({ x: 400, y: 520 });

  const boxRef = useRef<HTMLDivElement | null>(null);
  const processBoxRef = useRef<HTMLDivElement | null>(null);

  const [fullOpen, setFullOpen] = useState(false);

  // ✅ acordeón de fases en "Proceso"
  const [openPhaseId, setOpenPhaseId] = useState<Step["id"] | null>(null);

  const steps = useMemo<Step[]>(
    () => [
      {
        id: "poc",
        title: "Proof of Concept (PoC)",
        hover:
          "¿Funciona el principio fundamental? Física/mecanismo, pruebas rápidas y baratas.",
        details: [
          "Objetivo: confirmar hipótesis base (lo mínimo que debe ser cierto).",
          "Entregables: evidencia de viabilidad, pruebas simples, muestras rápidas.",
          "Materiales: simples, bajo costo, alta experimentación.",
          "Aprendizaje rápido > acabado.",
        ],
        question: "¿El principio funciona en lo más básico?",
        stepdown: "Si falla: reformular hipótesis / regresar a necesidad técnica.",
      },
      {
        id: "alpha",
        title: "Alpha Prototype",
        hover:
          "Integramos funciones clave en un sistema inicial. Iteración rápida, dimensiones aproximadas.",
        details: [
          "Objetivo: que el sistema haga lo esencial aunque no sea bonito.",
          "Enfoque: integración, ensamble, interfaces, ergonomía inicial.",
          "Dimensiones: aproximadas (ajustes frecuentes).",
          "Riesgo: fallas de integración → regresos controlados.",
        ],
        question: "¿Ya se integra lo esencial sin romperse cada vez?",
        stepdown: "Alpha → PoC si el principio aún no es consistente.",
      },
      {
        id: "beta",
        title: "Beta Prototype",
        hover:
          "Validamos desempeño en condiciones representativas. Materiales cercanos a finales y repetibilidad.",
        details: [
          "Objetivo: consistencia y seguridad bajo uso representativo.",
          "Materiales: cercanos a finales (o equivalentes funcionales).",
          "Tolerancias: más definidas y control de variación.",
          "Enfoque: repetibilidad, evaluación de riesgos, pruebas más formales.",
        ],
        question: "¿Funciona consistente y seguro en escenarios reales?",
        stepdown: "Beta → Alpha si integración/materiales aún cambian demasiado.",
      },
      {
        id: "preval",
        title: "Pre-Validation",
        hover:
          "Cerramos incertidumbre técnica antes de validación formal: diseño casi final y manufacturabilidad revisada.",
        details: [
          "Objetivo: reducir incertidumbre técnica a un nivel validable.",
          "Diseño: casi final, parámetros críticos definidos.",
          "Manufacturabilidad: evaluada (procesos, fixtures, tolerancias).",
          "Riesgos: controlados y documentados.",
        ],
        question: "¿Ya está listo para validar sin sorpresas técnicas?",
        stepdown: "Pre-Validation → Beta si pruebas detectan riesgo.",
      },
      {
        id: "transfer",
        title: "Transfer to Design Controls",
        hover:
          "La incertidumbre es baja: control formal (cambios, documentación, validación regulada).",
        details: [
          "Objetivo: operar bajo control de cambios y documentación formal.",
          "El prototipado se vuelve controlado y trazable.",
          "Pruebas: verificación/validación dentro del marco definido.",
          "Cambios: solo con evaluación de impacto.",
        ],
        question: "¿El sistema está estable para control formal?",
        stepdown:
          "Si aparece nueva incertidumbre: stepdown a Pre-Validation/Beta.",
      },
    ],
    []
  );

  const stepsById = useMemo(() => {
    const m = new Map<Step["id"], Step>();
    steps.forEach((s) => m.set(s.id, s));
    return m;
  }, [steps]);

  const nodes = useMemo<Node[]>(
    () => [
      { id: "poc", label: "PoC", x: 20, y: 32, color: "rgba(52, 211, 153, 0.22)" },
      { id: "alpha", label: "Alpha", x: 40, y: 54, color: "rgba(45, 212, 191, 0.22)" },
      { id: "beta", label: "Beta", x: 68, y: 34, color: "rgba(250, 204, 21, 0.18)" },
      { id: "preval", label: "Pre-Validation", x: 58, y: 74, color: "rgba(248, 113, 113, 0.18)" },
      { id: "transfer", label: "Design\nControls", x: 84, y: 78, color: "rgba(167, 139, 250, 0.16)" },
    ],
    []
  );

  const edges = useMemo<Edge[]>(
    () => [
      { from: "poc", to: "alpha", kind: "forward" },
      { from: "alpha", to: "beta", kind: "forward" },
      { from: "beta", to: "preval", kind: "forward" },
      { from: "preval", to: "transfer", kind: "forward" },

      { from: "beta", to: "alpha", kind: "stepdown" },
      { from: "preval", to: "beta", kind: "stepdown" },
      { from: "alpha", to: "poc", kind: "stepdown" },
    ],
    []
  );

  const activeId = (hoverId ?? selectedId ?? "poc") as Step["id"];
  const active = stepsById.get(activeId)!;

  // ✅ Anchor desde nodo (tab "que")
  const setAnchorFromNode = (node: Node) => {
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = rect.left + (node.x / 100) * rect.width;
    const y = rect.top + (node.y / 100) * rect.height;
    setAnchor({ x, y });
  };

  // ✅ Anchor desde cualquier elemento (tab "proceso")
  const setAnchorFromElement = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    // Punto “cómodo” al lado derecho del card
    setAnchor({ x: rect.right - 16, y: rect.top + rect.height * 0.35 });
  };

  const handleHover = (node: Node | null) => {
    if (!node) {
      setHoverId(null);
      return;
    }
    setHoverId(node.id);
    setAnchorFromNode(node);
  };

  const handleClick = (node: Node) => {
    setSelectedId(node.id);
    setAnchorFromNode(node);
  };

  // ✅ Steps “largos” para explicación completa (con imágenes opcionales)
  const fullSteps = useMemo(
    () => [
      {
        id: "poc",
        title: "Proof of Concept (PoC)",
        intro:
          "En PoC buscamos lo más básico: validar que el principio físico o mecánico realmente funciona. Aquí se permite experimentar, fallar rápido y aprender barato.",
        bullets: [
          "Hipótesis clara: qué debe funcionar sí o sí.",
          "Pruebas simples (bench tests).",
          "Materiales simples / prototipos rápidos.",
          "Decisión: viable / no viable / requiere replanteo.",
        ],
        example: {
          caption:
            "Ejemplo: un mecanismo impreso en 3D para probar sólo el movimiento, sin acabados.",
          imageSrc: "/prototipado/poc.jpg",
        },
      },
      {
        id: "alpha",
        title: "Alpha Prototype",
        intro:
          "En Alpha integramos funciones clave en un sistema inicial. Todavía iteramos mucho y las dimensiones pueden cambiar, pero ya existe un ‘producto’ que se puede usar para aprender.",
        bullets: [
          "Integración: ensambles, interfaces, ergonomía.",
          "Iteración rápida y cambios frecuentes.",
          "Pruebas funcionales (no necesariamente repetibles aún).",
          "Si falla lo esencial → stepdown a PoC.",
        ],
        example: {
          caption:
            "Ejemplo: modelo dimensional y de ensamble para validar compatibilidad entre piezas.",
          imageSrc: "/prototipado/alpha.jpg",
        },
      },
      {
        id: "beta",
        title: "Beta Prototype",
        intro:
          "En Beta validamos desempeño en condiciones representativas. Buscamos repetibilidad, seguridad y materiales cercanos a finales. Ya no es ‘probar por probar’: es confirmar.",
        bullets: [
          "Condiciones representativas de uso.",
          "Materiales cercanos a finales.",
          "Tolerancias y variación controlada.",
          "Evaluación de riesgos más formal.",
        ],
        example: {
          caption:
            "Ejemplo: pruebas repetidas para confirmar estabilidad térmica o mecánica.",
          imageSrc: "/prototipado/beta.jpg",
        },
      },
      {
        id: "preval",
        title: "Pre-Validation",
        intro:
          "Pre-Validation cierra incertidumbre técnica antes de validar formalmente. Es el puente: diseño casi final, manufacturabilidad evaluada y parámetros críticos definidos.",
        bullets: [
          "Diseño casi final (cambios menores).",
          "Manufacturabilidad y fixtures revisados.",
          "Parámetros críticos definidos.",
          "Si aparece riesgo → stepdown a Beta.",
        ],
        example: {
          caption:
            "Ejemplo: fixture o proceso definido para fabricar con consistencia.",
          imageSrc: "/prototipado/preval.jpg",
        },
      },
      {
        id: "transfer",
        title: "Transfer to Design Controls",
        intro:
          "Cuando la incertidumbre técnica es baja, el trabajo entra al marco regulado: control de cambios, documentación formal, verificación y validación. El prototipado no desaparece, se vuelve controlado.",
        bullets: [
          "Control formal de cambios.",
          "Documentación y trazabilidad.",
          "Verificación / validación conforme al sistema.",
          "Cambios con evaluación de impacto.",
        ],
        example: {
          caption:
            "Ejemplo: cambios documentados + evidencia de pruebas para cada iteración.",
          imageSrc: "/prototipado/transfer.jpg",
        },
      },
    ],
    []
  );

  // ✅ Data para “Proceso en Bioana”
  const processPhases = useMemo<ProcessPhase[]>(
    () => [
      {
        id: "poc",
        label: "PoC — Proof of Concept",
        uncertainty: {
          level: "Muy alta",
          note: "Hipótesis / principio fundamental aún no confirmado.",
        },
        objective:
          "Validar que el principio técnico (físico/mecánico/electrónico) funciona en lo mínimo indispensable.",
        primaryQuestion: "¿Funciona el principio base en lo más básico?",
        teams: [
          {
            team: "Ingeniería (R&D)",
            responsibilities: [
              "Definir la hipótesis y criterios de éxito.",
              "Aclarar restricciones y variables críticas.",
              "Decidir: viable / no viable / replanteo.",
            ],
          },
          {
            team: "Prototipado",
            responsibilities: [
              "Construir pruebas rápidas (bench tests).",
              "Ejecutar experimentos y documentar resultados.",
              "Proponer iteraciones rápidas para aprender.",
            ],
          },
        ],
        activities: [
          "Experimentos rápidos (función mínima).",
          "Comparación simple vs. criterios de éxito.",
          "Identificación de variables críticas (qué mueve el resultado).",
        ],
        deliverables: [
          "Evidencia de viabilidad (datos / fotos / notas).",
          "Lista de supuestos confirmados y no confirmados.",
          "Recomendación de siguiente paso (Alpha o replanteo).",
        ],
        decisions: ["Avanza a Alpha", "Reformular hipótesis", "Cancelar / pausar"],
        stepdowns: ["Si falla → regresar a necesidad técnica / hipótesis."],
      },
      {
        id: "alpha",
        label: "Alpha — Arquitectura",
        uncertainty: {
          level: "Alta",
          note: "La arquitectura del producto aún se explora (varias opciones).",
        },
        objective:
          "Construir uno o varios modelos funcionales preliminares para definir arquitectura, ensamble e interfaces.",
        primaryQuestion:
          "¿Qué arquitectura/configuración funciona mejor y por qué?",
        teams: [
          {
            team: "Diseño",
            responsibilities: [
              "Proponer configuraciones y arquitectura (CAD preliminar).",
              "Considerar ergonomía e interfaces (nivel inicial).",
              "Generar alternativas si hay varias necesidades.",
            ],
          },
          {
            team: "Prototipado",
            responsibilities: [
              "Fabricar iteraciones rápidas.",
              "Probar integración (ensamble, compatibilidad).",
              "Detectar fallas de integración y proponer ajustes.",
            ],
          },
          {
            team: "Ingeniería (R&D)",
            responsibilities: [
              "Evaluar desempeño vs. criterios.",
              "Descartar o seleccionar opciones.",
              "Comunicar cambios/ajustes de especificación.",
            ],
          },
          {
            team: "Cliente / Stakeholders",
            responsibilities: [
              "Dar retroalimentación de preferencia/uso (si aplica).",
              "Validar que la solución propuesta responda a la necesidad.",
            ],
          },
        ],
        activities: [
          "Lluvia de ideas + varias arquitecturas.",
          "Prototipos semifuncionales (rápidos).",
          "Pruebas de integración y uso básico.",
        ],
        deliverables: [
          "1–N modelos Alpha con pros/cons.",
          "Selección de arquitectura base (o combinación).",
          "Lista de ajustes requeridos para Beta.",
        ],
        decisions: ["Elegir arquitectura", "Iterar Alpha", "Stepdown a PoC"],
        stepdowns: ["Alpha → PoC si el principio base aún es inconsistente."],
      },
      {
        id: "beta",
        label: "Beta — Refinamiento",
        uncertainty: {
          level: "Media",
          note: "Funciona, pero falta robustez, repetibilidad y selección final.",
        },
        objective:
          "Refinar el modelo Alpha para hacerlo consistente, seguro y cercano a la versión final.",
        primaryQuestion:
          "¿Es robusto y repetible en condiciones representativas?",
        teams: [
          {
            team: "Diseño",
            responsibilities: [
              "Materiales cercanos a finales (o equivalentes funcionales).",
              "Ajustes dimensionales finos y tolerancias.",
              "Definir parámetros críticos del diseño.",
            ],
          },
          {
            team: "Prototipado",
            responsibilities: [
              "Fabricación con enfoque a repetibilidad.",
              "Pruebas repetidas (consistencia).",
              "Documentar resultados y variación observada.",
            ],
          },
          {
            team: "Ingeniería (R&D)",
            responsibilities: [
              "Validación técnica vs. especificaciones.",
              "Evaluación preliminar de riesgos y condiciones de uso.",
              "Aprobación para entrar a Pre-validación.",
            ],
          },
        ],
        activities: [
          "Pruebas representativas (uso realista).",
          "Evaluación de variación (qué cambia entre piezas).",
          "Iteraciones controladas para robustecer.",
        ],
        deliverables: [
          "Prototipo Beta funcional y consistente.",
          "Parámetros críticos definidos (lo que NO puede cambiar).",
          "Reporte de desempeño y riesgos preliminares.",
        ],
        decisions: ["Avanzar a Pre-validación", "Iterar Beta", "Stepdown a Alpha"],
        stepdowns: [
          "Beta → Alpha si integración/materiales cambian demasiado.",
          "Beta → PoC si cambió una especificación crítica con alta incertidumbre.",
        ],
      },
      {
        id: "preval",
        label: "Pre-validación — Manufacturabilidad",
        uncertainty: {
          level: "Baja",
          note: "La tecnología está madura; ahora importa producir bien y consistente.",
        },
        objective:
          "Cerrar la incertidumbre técnica residual y validar manufacturabilidad (proceso, fixtures, ensamble).",
        primaryQuestion:
          "¿Podemos fabricar esto consistentemente y de forma eficiente?",
        teams: [
          {
            team: "Manufactura",
            responsibilities: [
              "Definir método productivo y secuencia de ensamble.",
              "Evaluar capacidad instalada y limitantes.",
              "Optimizar tiempos y proceso.",
            ],
          },
          {
            team: "Prototipado",
            responsibilities: [
              "Diseñar/ajustar fixtures y herramientas.",
              "Probar ensamblaje y repetibilidad del proceso.",
              "Documentar mejoras de proceso.",
            ],
          },
          {
            team: "Ingeniería (R&D)",
            responsibilities: [
              "Autorizar cambios necesarios para manufactura.",
              "Confirmar especificaciones finales (críticas).",
              "Aprobar entrada a Design Controls.",
            ],
          },
          {
            team: "Calidad (si aplica)",
            responsibilities: [
              "Asegurar trazabilidad básica y control documental.",
              "Acompañar identificación de riesgos y controles.",
            ],
          },
        ],
        activities: [
          "Diseño de fixtures y método de ensamble.",
          "Corridas repetidas para verificar consistencia.",
          "Revisión de tolerancias críticas desde manufactura.",
        ],
        deliverables: [
          "Proceso definido (método + fixtures).",
          "Lista de capacidades y limitantes.",
          "Paquete técnico listo para transferencia.",
        ],
        decisions: ["Transferir", "Ajustar proceso", "Stepdown a Beta"],
        stepdowns: ["Pre-validación → Beta si aparece riesgo o limitante seria."],
      },
      {
        id: "transfer",
        label: "Transfer — Design Controls",
        uncertainty: {
          level: "Mínima",
          note: "Se opera con control formal de cambios y trazabilidad.",
        },
        objective:
          "Transferir a control formal (cambios, documentación, verificación/validación) sin reabrir incertidumbre técnica.",
        primaryQuestion: "¿El sistema está estable para un marco controlado?",
        teams: [
          {
            team: "Ingeniería (R&D)",
            responsibilities: [
              "Gestionar cambios con evaluación de impacto.",
              "Definir/verificar requisitos finales.",
              "Acompañar V&V dentro del marco.",
            ],
          },
          {
            team: "Calidad / Regulatory (si aplica)",
            responsibilities: [
              "Control documental y trazabilidad.",
              "Revisión del flujo de cambios.",
              "Asegurar evidencia y registros.",
            ],
          },
          {
            team: "Manufactura",
            responsibilities: [
              "Ejecución del proceso definido.",
              "Control de variación y retroalimentación técnica.",
              "Identificación de problemas de producción.",
            ],
          },
        ],
        activities: [
          "Control de cambios formal.",
          "Verificación/validación según plan.",
          "Monitoreo de desviaciones y acciones correctivas.",
        ],
        deliverables: [
          "Documentación formal y trazable.",
          "Evidencia de pruebas V&V según marco definido.",
          "Release controlado (según aplique).",
        ],
        decisions: [
          "Mantener control",
          "Evaluar cambio",
          "Stepdown si reaparece incertidumbre",
        ],
        stepdowns: [
          "Si aparece nueva incertidumbre → stepdown a Pre-validación o Beta.",
        ],
      },
    ],
    []
  );

  // Para el termómetro: orden y posición
  const thermometerOrder = useMemo(
    () => ["poc", "alpha", "beta", "preval", "transfer"] as Step["id"][],
    []
  );

  const thermometerIndex = useMemo(() => {
    const key = (hoverId ?? openPhaseId ?? "poc") as Step["id"];
    return Math.max(0, thermometerOrder.indexOf(key));
  }, [hoverId, openPhaseId, thermometerOrder]);

  const thermometerPct = useMemo(() => {
    const denom = Math.max(1, thermometerOrder.length - 1);
    return thermometerIndex / denom;
  }, [thermometerIndex, thermometerOrder.length]);

  return (
    <div className="min-h-screen px-6 py-20 text-white">
      <div className="max-w-6xl mx-auto">
        <div className="mt-2 flex justify-center">
          <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-1">
            <button
              onClick={() => setTab("que")}
              className={[
                "px-4 py-2 rounded-xl text-sm transition",
                tab === "que"
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "text-gray-300 hover:bg-white/5",
              ].join(" ")}
            >
              ¿Qué es prototipar?
            </button>
            <button
              onClick={() => setTab("proceso")}
              className={[
                "px-4 py-2 rounded-xl text-sm transition",
                tab === "proceso"
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "text-gray-300 hover:bg-white/5",
              ].join(" ")}
            >
              Proceso en Bioana
            </button>
            <button
              onClick={() => setTab("diagnostico")}
              className={[
                "px-4 py-2 rounded-xl text-sm transition",
                tab === "diagnostico"
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "text-gray-300 hover:bg-white/5",
              ].join(" ")}
            >
              Diagnóstico de fase
            </button>
          </div>
        </div>

        {tab !== "que" ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl p-8 text-gray-200">
            {tab === "proceso" && (
              <div ref={processBoxRef}>
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Proceso de Prototipado en Bioana
                    </h2>
                    <p className="mt-2 text-gray-300 max-w-3xl">
                      A medida que avanzamos, la incertidumbre técnica disminuye
                      y aumentan la repetibilidad, manufacturabilidad y control
                      formal. Expande cada fase para ver equipos, actividades y
                      entregables.
                    </p>
                  </div>
                  <div className="shrink-0" />
                </div>

                <div className="mt-8 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
                  {/* ✅ Termómetro */}
                  <div className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md p-5">
                    <p className="text-sm font-semibold text-white">Incertidumbre</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Arriba: alta • Abajo: baja
                    </p>

                    <div className="mt-5 relative h-[420px] w-full flex items-center justify-center">
                      <div className="relative w-10 h-full rounded-full border border-white/10 overflow-hidden bg-white/5">
                        <div
                          className="absolute inset-0"
                          style={{
                            background:
                              "linear-gradient(to bottom, rgba(248,113,113,0.55), rgba(250,204,21,0.45), rgba(52,211,153,0.40), rgba(59,130,246,0.35))",
                          }}
                        />

                        <motion.div
                          className="absolute left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border border-white/20 bg-black/60 shadow-2xl"
                          animate={{ top: `calc(${thermometerPct * 100}% - 16px)` }}
                          transition={{ type: "spring", stiffness: 240, damping: 26 }}
                        />

                        {thermometerOrder.map((id, i) => {
                          const pct =
                            (i / Math.max(1, thermometerOrder.length - 1)) *
                            100;
                          return (
                            <div
                              key={id}
                              className="absolute left-0 right-0 flex items-center justify-between px-2"
                              style={{ top: `calc(${pct}% - 6px)` }}
                            >
                              <span className="w-2 h-[2px] bg-white/25 rounded" />
                              <span className="w-2 h-[2px] bg-white/10 rounded" />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4 text-xs text-gray-300">
                      <p className="text-gray-400">Fase activa:</p>
                      <p className="mt-1 text-white font-semibold">
                        {(hoverId ?? openPhaseId ?? "poc").toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {/* ✅ Fases expandibles */}
                  <div className="space-y-3">
                    {processPhases.map((phase, idx) => {
                      const isOpen = openPhaseId === phase.id;

                      return (
                        <div key={phase.id} className="relative">
                          {idx !== 0 && (
                            <div className="absolute -top-3 left-6 text-gray-500/80 select-none">
                              <span className="text-lg">↓</span>
                            </div>
                          )}

                          <motion.button
                            type="button"
                            onMouseEnter={(e) => {
                              setHoverId(phase.id);
                              setAnchorFromElement(e.currentTarget);
                            }}
                            onMouseLeave={() => setHoverId(null)}
                            onClick={() => {
                              setSelectedId(phase.id);
                              setOpenPhaseId((prev) =>
                                prev === phase.id ? null : phase.id
                              );
                            }}
                            className={[
                              "w-full text-left rounded-2xl border bg-white/5 backdrop-blur-md shadow-2xl transition",
                              isOpen
                                ? "border-emerald-400/30"
                                : "border-white/10 hover:border-emerald-400/20",
                            ].join(" ")}
                          >
                            <div className="p-5 flex items-start justify-between gap-4">
                              <div>
                                <p className="text-xs text-gray-400">
                                  Incertidumbre:{" "}
                                  <span className="text-gray-200 font-semibold">
                                    {phase.uncertainty.level}
                                  </span>
                                  <span className="text-gray-500">
                                    {" "}
                                    — {phase.uncertainty.note}
                                  </span>
                                </p>

                                <h3 className="mt-1 text-base md:text-lg font-semibold text-white">
                                  {phase.label}
                                </h3>

                                <p className="mt-2 text-sm text-gray-300">
                                  {phase.objective}
                                </p>
                              </div>

                              <div className="shrink-0">
                                <span
                                  className={[
                                    "inline-flex items-center px-3 py-1 rounded-xl text-xs border",
                                    isOpen
                                      ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/20"
                                      : "bg-white/5 text-gray-300 border-white/10",
                                  ].join(" ")}
                                >
                                  {isOpen ? "Contraer" : "Expandir"}
                                </span>
                              </div>
                            </div>

                            <AnimatePresence initial={false}>
                              {isOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.25 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-5 pb-5">
                                    <div className="mt-1 rounded-xl border border-white/10 bg-black/25 p-4">
                                      <p className="text-xs text-gray-400">
                                        Pregunta clave
                                      </p>
                                      <p className="mt-1 text-sm text-white font-semibold">
                                        {phase.primaryQuestion}
                                      </p>
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                        <p className="text-sm font-semibold text-white">
                                          Teams & Responsabilidades
                                        </p>
                                        <div className="mt-3 space-y-3">
                                          {phase.teams.map((t) => (
                                            <div key={t.team}>
                                              <p className="text-xs text-emerald-200 font-semibold">
                                                {t.team}
                                              </p>
                                              <ul className="mt-1 list-disc list-inside text-sm text-gray-300 space-y-1">
                                                {t.responsibilities.map(
                                                  (r, i) => (
                                                    <li key={i}>{r}</li>
                                                  )
                                                )}
                                              </ul>
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="space-y-4">
                                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                          <p className="text-sm font-semibold text-white">
                                            Actividades típicas
                                          </p>
                                          <ul className="mt-2 list-disc list-inside text-sm text-gray-300 space-y-1">
                                            {phase.activities.map((a, i) => (
                                              <li key={i}>{a}</li>
                                            ))}
                                          </ul>
                                        </div>

                                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                          <p className="text-sm font-semibold text-white">
                                            Entregables
                                          </p>
                                          <ul className="mt-2 list-disc list-inside text-sm text-gray-300 space-y-1">
                                            {phase.deliverables.map((d, i) => (
                                              <li key={i}>{d}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                        <p className="text-sm font-semibold text-white">
                                          Decisiones de salida
                                        </p>
                                        <ul className="mt-2 list-disc list-inside text-sm text-gray-300 space-y-1">
                                          {phase.decisions.map((x, i) => (
                                            <li key={i}>{x}</li>
                                          ))}
                                        </ul>
                                      </div>

                                      <div className="rounded-xl border border-rose-400/15 bg-rose-500/5 p-4">
                                        <p className="text-sm font-semibold text-rose-200">
                                          Stepdowns (retrocesos normales)
                                        </p>
                                        <ul className="mt-2 list-disc list-inside text-sm text-gray-300 space-y-1">
                                          {phase.stepdowns.map((x, i) => (
                                            <li key={i}>{x}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {tab === "diagnostico" && <DiagnosticoFase />}
          </div>
        ) : (
          <>
            {/* ✅ Definición arriba del diagrama */}
            <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl p-6">
              <p className="text-[15px] text-emerald-300/90 font-semibold tracking-wide">
                Definición
              </p>
              <p className="mt-2 text-base md:text-lg leading-relaxed text-gray-100">
                Prototipar es el proceso estructurado mediante el cual reducimos
                incertidumbre técnica hasta alcanzar un nivel de confianza
                suficiente para validar o escalar un sistema.
              </p>
            </div>

            <div
              ref={boxRef}
              className="relative mt-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Diagrama de Prototipado
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Coloca el cursor en una fase de prototipado.
                  </p>
                </div>

                <button
                  onClick={() => setFullOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-200 border border-emerald-400/20 hover:bg-emerald-500/25 transition text-sm"
                >
                  Explicación completa
                </button>
              </div>

              <div className="relative h-[520px]">
                {/* Flechas */}
                <svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <marker
                      id="arrowForward"
                      markerWidth="10"
                      markerHeight="10"
                      refX="9"
                      refY="5"
                      orient="auto"
                    >
                      <path
                        d="M0,0 L10,5 L0,10 z"
                        fill="rgba(52,211,153,0.65)"
                      />
                    </marker>
                    <marker
                      id="arrowBack"
                      markerWidth="10"
                      markerHeight="10"
                      refX="9"
                      refY="5"
                      orient="auto"
                    >
                      <path
                        d="M0,0 L10,5 L0,10 z"
                        fill="rgba(248,113,113,0.60)"
                      />
                    </marker>
                  </defs>

                  {edges.map((e, idx) => {
                    const from = nodes.find((n) => n.id === e.from)!;
                    const to = nodes.find((n) => n.id === e.to)!;

                    const stroke =
                      e.kind === "forward"
                        ? "rgba(52,211,153,0.55)"
                        : "rgba(248,113,113,0.45)";
                    const dash = e.kind === "stepdown" ? "4 3" : "0";

                    return (
                      <line
                        key={idx}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke={stroke}
                        strokeWidth="0.6"
                        strokeDasharray={dash}
                        markerEnd={
                          e.kind === "forward"
                            ? "url(#arrowForward)"
                            : "url(#arrowBack)"
                        }
                      />
                    );
                  })}
                </svg>

                {/* Nodos */}
                {nodes.map((n) => {
                  const isActive = activeId === n.id;
                  return (
                    <div
                      key={n.id}
                      className="absolute"
                      style={{
                        left: `${n.x}%`,
                        top: `${n.y}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                      onMouseEnter={() => handleHover(n)}
                      onMouseLeave={() => handleHover(null)}
                      onClick={() => handleClick(n)}
                    >
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.98 }}
                        className={[
                          "relative w-[120px] h-[120px] rounded-full",
                          "border shadow-2xl transition",
                          "bg-black/45 backdrop-blur-md",
                          isActive
                            ? "border-emerald-400/50 ring-2 ring-emerald-400/20"
                            : "border-white/10 hover:border-emerald-400/25",
                        ].join(" ")}
                      >
                        <span
                          className="absolute -inset-2 rounded-full blur-2xl"
                          style={{ background: n.color }}
                        />
                        <span className="relative z-10 text-sm font-semibold text-white whitespace-pre-line">
                          {n.label}
                        </span>
                      </motion.button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ✅ ADAM: visible solo si hoverId existe */}
            <AdamAssistant
              visible={!!hoverId}
              anchor={anchor}
              step={{
                id: active.id,
                title: active.title,
                body: active.hover,
              }}
            />

            {/* ✅ Modal “Explicación completa” */}
            <PrototipadoFullModal
              open={fullOpen}
              onClose={() => setFullOpen(false)}
              steps={fullSteps}
              startIndex={0}
            />
          </>
        )}
      </div>

      {/* ✅ ADAM también funciona en Proceso (reusa hoverId + anchor) */}
      {tab === "proceso" && (
        <AdamAssistant
          visible={!!hoverId}
          anchor={anchor}
          step={{
            id: activeId,
            title: stepsById.get(activeId)?.title ?? "Proceso",
            body: stepsById.get(activeId)?.hover ?? "",
          }}
        />
      )}
    </div>
  );
}
