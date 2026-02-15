"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AdamAssistant from "@/app/components/AdamAssistant";

type TourStep = {
  target: string;
  id: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right";
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isRectInViewport(r: DOMRect, margin = 8) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return (
    r.bottom > margin &&
    r.right > margin &&
    r.top < vh - margin &&
    r.left < vw - margin
  );
}

export default function SpotlightTour({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const RELOAD_ON_FINISH = false; // 👈 ponlo en true si quieres refresh al final

  const baseSteps: TourStep[] = useMemo(
    () => [
      {
        id: "place-order",
        target: '[data-tutorial="card-place-order"]',
        title: "Place Order",
        body: "Aquí creas un pedido nuevo: proyecto → servicio → técnica/máquina → material → especificaciones (y adjuntas archivos).",
        placement: "right",
      },
      {
        id: "frequent-orders",
        target: '[data-tutorial="card-frequent-orders"]',
        title: "Frequent Orders",
        body: "Atajos a combinaciones comunes. Selecciona uno para autollenar y saltar directo a especificaciones.",
        placement: "left",
      },
      {
        id: "calendar",
        target: '[data-tutorial="nav-calendar"]',
        title: "Calendar",
        body: "Aquí podrás revisar las solicitudes programadas que tiene el laboratorio y tomar en cuenta la carga de trabajo. Realiza tus solicitudes con tiempo.",
        placement: "bottom",
      },
        {
        id: "about",
        target: '[data-tutorial="nav-about"]',
        title: "About",
        body: "Aquí podrás aprender sobre lo que es el prototipado, sus fases y el proceso que debemos seguir, así como los equipos que podemos utilizar para hacer realidad los proyectos.",
        placement: "bottom",
      },
      {
        id: "collection",
        target: '[data-tutorial="nav-collection"]',
        title: "Collection",
        body: "Galería de prototipos/fixtures del lab para referencia e inspiración.",
        placement: "bottom",
      },
      {
        id: "projects",
        target: '[data-tutorial="nav-projects"]',
        title: "My Projects",
        body: "Aquí ves tus pedidos agrupados por proyecto por si necesitas revisar status, o cambiar/agregar alguna especificación.",
        placement: "bottom",
      },
      
      {
        id: "inventory",
        target: '[data-tutorial="nav-inventory"]',
        title: "Inventory",
        body: "Consulta materiales/recursos del laboratorio para planear y evitar sorpresas.",
        placement: "bottom",
      },
      {
        id: "quoter",
        target: '[data-tutorial="nav-quoter"]',
        title: "Quoter",
        body: "Estimación de costos y cotizaciones (solo admin).",
        placement: "bottom",
      },
      {
        id: "analytics",
        target: '[data-tutorial="nav-analytics"]',
        title: "Analytics",
        body: "Reportes/tendencias para planeación y presupuesto (solo admin).",
        placement: "bottom",
      },
      
      {
        id: "history",
        target: '[data-tutorial="section-order-history"]',
        title: "Order History",
        body: "Ruta rápida de tus pedidos recientes para cambiar/agregar especificaciones.",
        placement: "top",
      },
    ],
    []
  );

  const [steps, setSteps] = useState<TourStep[]>([]);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [inView, setInView] = useState(true);

  const step = steps[idx];

  // ✅ Scroll lock mientras está abierto (para que NO se mueva la página)
  useEffect(() => {
    if (!open) return;

    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyPosition = document.body.style.position;
    const prevBodyWidth = document.body.style.width;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "relative";
    document.body.style.width = "100%";

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.position = prevBodyPosition;
      document.body.style.width = prevBodyWidth;
    };
  }, [open]);

  // Filtra pasos visibles en DOM (no depende de scroll)
  useEffect(() => {
    if (!open) return;
    const filtered = baseSteps.filter((s) => !!document.querySelector(s.target));
    setSteps(filtered);
    setIdx(0);
  }, [open, baseSteps]);

  // Medición precisa del target (SIN scrollIntoView)
  useEffect(() => {
    if (!open || !step) return;

    const el = document.querySelector(step.target) as HTMLElement | null;
    if (!el) {
      setRect(null);
      setInView(false);
      return;
    }

    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect(r);
      setInView(isRectInViewport(r, 10));
    };

    // Medir ahora + en el siguiente frame (por si hay layout)
    measure();
    requestAnimationFrame(measure);

    const ro = new ResizeObserver(() => requestAnimationFrame(measure));
    ro.observe(el);

    const onRecalc = () => requestAnimationFrame(measure);
    window.addEventListener("resize", onRecalc);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onRecalc);
    };
  }, [open, step]);

  // Teclas
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowRight") setIdx((v) => clamp(v + 1, 0, steps.length - 1));
      if (e.key === "ArrowLeft") setIdx((v) => clamp(v - 1, 0, steps.length - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, steps.length]);

  useEffect(() => {
    if (open && steps.length === 0) handleClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, steps.length]);

  const handleClose = () => {
    // ✅ reset extra por si acaso
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.width = "";
    onClose();
  };

  const handleFinish = () => {
    handleClose();
    if (RELOAD_ON_FINISH) window.location.reload();
  };

  const pad = 10;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  const headerH =
    typeof window !== "undefined"
      ? (document.querySelector("header") as HTMLElement | null)?.getBoundingClientRect()
          .height ?? 0
      : 0;

  // Spotlight solo si está en viewport; si no, no dibujamos spotlight (solo ADAM/tooltip)
  const spot =
    rect && inView
      ? {
          top: Math.max(0, rect.top - pad),
          left: Math.max(0, rect.left - pad),
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
        }
      : null;

  // Anchor para ADAM:
  // - si el target está visible: centro del elemento
  // - si NO está visible: punto seguro debajo del header, centrado
  const anchor =
    rect && inView
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: vw * 0.62, y: headerH + 120 };

  const next = () => {
    if (idx >= steps.length - 1) handleFinish();
    else setIdx((v) => v + 1);
  };
  const back = () => setIdx((v) => clamp(v - 1, 0, steps.length - 1));

  return (
    <AnimatePresence>
      {open && step && (
        <motion.div
          className="fixed inset-0 z-[9999]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Overlay */}
          {spot ? (
            <div className="absolute inset-0">
              <div
                className="absolute left-0 right-0 top-0 bg-black/70"
                style={{ height: spot.top }}
                onClick={handleClose}
              />
              <div
                className="absolute bg-black/70"
                style={{ top: spot.top, left: 0, width: spot.left, height: spot.height }}
                onClick={handleClose}
              />
              <div
                className="absolute bg-black/70"
                style={{
                  top: spot.top,
                  left: spot.left + spot.width,
                  width: vw - (spot.left + spot.width),
                  height: spot.height,
                }}
                onClick={handleClose}
              />
              <div
                className="absolute left-0 right-0 bg-black/70"
                style={{ top: spot.top + spot.height, bottom: 0 }}
                onClick={handleClose}
              />
            </div>
          ) : (
            <div className="absolute inset-0 bg-black/70" onClick={handleClose} />
          )}

          {/* Borde spotlight */}
          {spot && (
            <motion.div
              className="absolute rounded-2xl border border-white/15 pointer-events-none"
              style={{
                top: spot.top,
                left: spot.left,
                width: spot.width,
                height: spot.height,
              }}
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
            />
          )}

          {/* Barra inferior */}
          <motion.div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[min(720px,calc(100vw-24px))]
              rounded-2xl border border-white bg-neutral-950/70 backdrop-blur px-4 py-3"
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-white/50">
                Step {idx + 1} / {steps.length}
                {!inView && (
                  <span className="ml-2 text-[11px] text-amber-300/90">
                    (Ese apartado no está visible en pantalla; ADAM te lo explica igual)
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button className="text-sm text-white/60 hover:text-white" onClick={handleClose}>
                  Skip
                </button>
                <button
                  className="rounded-xl border border-white/50 px-3 py-2 text-sm text-white/100 hover:bg-white/5 disabled:opacity-30"
                  onClick={back}
                  disabled={idx === 0}
                >
                  Back
                </button>
                <button
                  className="rounded-xl bg-emerald-400/90 px-3 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
                  onClick={next}
                >
                  {idx === steps.length - 1 ? "Finish" : "Next"}
                </button>
              </div>
            </div>
          </motion.div>

          {/* ADAM arriba del overlay */}
          <div className="fixed inset-0 pointer-events-none z-[10050]">
            <AdamAssistant visible step={{ id: step.id, title: step.title, body: step.body }} anchor={anchor} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
