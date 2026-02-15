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

export default function PrototipadoPage() {
  const [tab, setTab] = useState<"que" | "proceso" | "diagnostico">("que");

  const [hoverId, setHoverId] = useState<Step["id"] | null>(null);
  const [selectedId, setSelectedId] = useState<Step["id"] | null>(null);

  // Anchor en viewport (fixed)
  const [anchor, setAnchor] = useState({ x: 400, y: 520 });

  const boxRef = useRef<HTMLDivElement | null>(null);

  const [fullOpen, setFullOpen] = useState(false);

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
      { id: "preval", label: "Pre-", x: 58, y: 74, color: "rgba(248, 113, 113, 0.18)" },
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

  // ✅ Anchor en viewport cerca del círculo (sale fuera del recuadro si hace falta)
  const setAnchorFromNode = (node: Node) => {
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = rect.left + (node.x / 100) * rect.width;
    const y = rect.top + (node.y / 100) * rect.height;
    setAnchor({ x, y });
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
          imageSrc: "/prototipado/poc.jpg", // opcional
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
          imageSrc: "/prototipado/alpha.jpg", // opcional
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
          imageSrc: "/prototipado/beta.jpg", // opcional
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
          imageSrc: "/prototipado/preval.jpg", // opcional
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
          imageSrc: "/prototipado/transfer.jpg", // opcional
        },
      },
    ],
    []
  );

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
              <>
                <h2 className="text-xl font-semibold text-white">
                  Proceso en Bioana
                </h2>
                <p className="mt-3 text-gray-300">
                  Aquí irá el segundo diagrama (lo armamos igual: nodos, flechas,
                  hover + click).
                </p>
              </>
            )}
            {tab === "diagnostico" && (
              <>
                <h2 className="text-xl font-semibold text-white">
                  Diagnóstico de fase
                </h2>
                <p className="mt-3 text-gray-300">
                  Sí es posible: haremos un formulario con preguntas y al final
                  sugiere fase + justificación.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* ✅ Definición arriba del diagrama */}
            <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl p-6">
              <p className="text-[11px] text-emerald-300/90 font-semibold tracking-wide">
                Definición
              </p>
              <p className="mt-2 text-base md:text-lg leading-relaxed text-gray-100">
                Prototipar es el proceso estructurado mediante el cual reducimos
                incertidumbre técnica hasta alcanzar un nivel de confianza suficiente
                para validar o escalar un sistema.
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
                  <p className="text-xs text-gray-400 mt-1">
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

            {/* ✅ ADAM: ahora puede verse fuera del recuadro, pero SOLO si hoverId existe */}
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
    </div>
  );
}
