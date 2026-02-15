"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

type AdamStep = {
  id: string;
  title: string;
  body: string;
};

type Anchor = {
  x: number; // viewport px
  y: number; // viewport px
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function AdamAssistant({
  step,
  anchor,
  visible,
}: {
  step: AdamStep;
  anchor: Anchor;
  visible: boolean;
}) {
  const ADAM_SIZE = 170; // 👈 hazlo más grande aquí (170–220 queda bien)
  const PANEL_W = 360;
  const GAP = 14;

  // Calcula posición basada en viewport (fixed)
  // Intentamos poner el panel a la derecha; si no cabe, lo movemos a la izquierda.
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1200;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;

  const preferredLeft = anchor.x + GAP; // panel a la derecha del punto
  const fitsRight = preferredLeft + PANEL_W + 24 < viewportW;

  const left = clamp(
    fitsRight ? preferredLeft : anchor.x - PANEL_W - GAP,
    16,
    viewportW - PANEL_W - 16
  );

  const top = clamp(anchor.y - ADAM_SIZE * 0.55, 16, viewportH - 220);

  // Adam “pegado” al panel
  const adamLeft = fitsRight ? left - ADAM_SIZE + 12 : left + PANEL_W - 12;
  const adamTop = top + 18;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed z-[90] pointer-events-none"
          initial={{ opacity: 0, scale: 0.98, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 6 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          style={{ left, top }}
        >
          <div className="relative">
            {/* ADAM */}
            <motion.div
              className="absolute select-none"
              style={{ left: adamLeft - left, top: adamTop - top, width: ADAM_SIZE, height: ADAM_SIZE }}
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Image
                src="/adam.png"
                alt="ADAM"
                fill
                className="object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.6)]"
                priority
              />
            </motion.div>

            {/* Panel tipo videojuego */}
            <div className="relative" style={{ width: PANEL_W }}>
              <div className="absolute -inset-3 rounded-[26px] bg-emerald-500/10 blur-2xl" />

              <div className="relative rounded-2xl border border-white/12 bg-black/75 backdrop-blur-md shadow-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-emerald-500/10 via-white/5 to-transparent">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                    <p className="text-sm font-semibold text-white">ADAM • Guía de Prototipado</p>
                  </div>
                </div>

                <div className="px-4 py-4">
                  <p className="text-xs text-emerald-300/90 font-semibold tracking-wide">{step.title}</p>
                  <p className="mt-2 text-sm text-gray-100 leading-relaxed">{step.body}</p>

                  
                </div>

                {/* cola hacia ADAM */}
                <div
                  className={[
                    "absolute bottom-12 w-5 h-5 bg-black/75 border-l border-b border-white/12 rotate-45",
                    fitsRight ? "-left-2" : "-right-2",
                  ].join(" ")}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
