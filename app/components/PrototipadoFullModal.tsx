"use client";

import React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type FullStep = {
  id: string;
  title: string;
  intro: string; // texto largo
  bullets: string[]; // puntos clave
  example?: {
    caption: string;
    imageSrc?: string; // /prototipado/poc.jpg etc
  };
};

function useTypewriter(text: string, enabled: boolean, speedMs = 18) {
  const [out, setOut] = React.useState("");
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    // reset cuando cambia el texto
    setOut("");
    setDone(false);

    if (!enabled) {
      setOut(text);
      setDone(true);
      return;
    }

    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
        setDone(true);
      }
    }, speedMs);

    return () => window.clearInterval(id);
  }, [text, enabled, speedMs]);

  const skip = React.useCallback(() => {
    setOut(text);
    setDone(true);
  }, [text]);

  return { out, done, skip };
}

export default function PrototipadoFullModal({
  open,
  onClose,
  steps,
  startIndex = 0,
}: {
  open: boolean;
  onClose: () => void;
  steps: FullStep[];
  startIndex?: number;
}) {
  const [idx, setIdx] = React.useState(startIndex);

  // control de typing
  const [typingEnabled, setTypingEnabled] = React.useState(true);

  // Si abres el modal y quieres iniciar en startIndex:
  React.useEffect(() => {
    if (open) {
      setIdx(startIndex);
      setTypingEnabled(true);
    }
  }, [open, startIndex]);

  const step = steps[idx];

  const prev = () => {
    setIdx((v) => (v - 1 + steps.length) % steps.length);
    setTypingEnabled(true);
  };

  const next = () => {
    setIdx((v) => (v + 1) % steps.length);
    setTypingEnabled(true);
  };

  const { out: typedIntro, done: introDone, skip: skipIntro } = useTypewriter(
    step.intro,
    open && typingEnabled,
    16 // velocidad: menor = más rápido
  );

  // Cursor parpadeante tipo videojuego
  const [blink, setBlink] = React.useState(true);
  React.useEffect(() => {
    const t = window.setInterval(() => setBlink((b) => !b), 420);
    return () => window.clearInterval(t);
  }, []);

  // Click / teclado para "saltar" el typing
  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " " || e.key === "Enter") {
        // Space/Enter: si aún está escribiendo, completa
        if (!introDone) skipIntro();
      }
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, introDone, skipIntro]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* overlay */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
            className="relative w-[min(1100px,92vw)] h-[min(720px,88vh)] rounded-3xl border border-white/12 bg-black/70 backdrop-blur-md shadow-2xl overflow-hidden"
            onClick={() => {
              // click dentro del modal: si aún escribe, completa
              if (!introDone) skipIntro();
            }}
          >
            {/* header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <p className="text-sm text-emerald-300/90 font-semibold tracking-wide">
                  Explicación completa
                </p>
                <h2 className="text-lg font-semibold text-white">{step.title}</h2>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/10 transition"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5 text-gray-200" />
              </button>
            </div>

            {/* body */}
            <div className="grid md:grid-cols-[420px_1fr] gap-0 h-[calc(100%-64px)]">
              {/* ADAM grande */}
              <div className="relative border-r border-white/10">
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent" />
                <div className="relative h-full flex items-center justify-center p-6">
                  <motion.div
                    className="relative w-[320px] h-[320px] md:w-[360px] md:h-[360px]"
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Image
                      src="/adam.png"
                      alt="ADAM"
                      fill
                      className="object-contain drop-shadow-[0_26px_50px_rgba(0,0,0,0.65)]"
                      priority
                    />
                  </motion.div>
                </div>

                {/* Controles */}
                <div className="absolute bottom-5 left-0 right-0 flex items-center justify-center gap-3">
                  <button
                    onClick={prev}
                    className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm text-gray-100 flex items-center gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </button>
                  <button
                    onClick={next}
                    className="px-4 py-2 rounded-xl border border-emerald-400/20 bg-emerald-500/20 hover:bg-emerald-500/25 transition text-sm text-emerald-100 flex items-center gap-2"
                  >
                    Siguiente
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                
              </div>

              {/* Texto + ejemplo (tipo videojuego) */}
              <div className="relative p-6 overflow-auto">
                <div className="absolute -inset-3 rounded-[26px] bg-emerald-500/8 blur-2xl pointer-events-none" />

                <div className="relative rounded-2xl border border-white/12 bg-black/55 p-5">
                  {/* Intro tipo videojuego */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] text-emerald-300/90 font-semibold tracking-wide">
                      Narrativa
                    </p>
                    <p className="mt-2 text-gray-200 leading-relaxed whitespace-pre-line">
                      {typedIntro}
                      {!introDone && (
                        <span className="ml-1 text-emerald-200">
                          {blink ? "▍" : " "}
                        </span>
                      )}
                    </p>

                  
                  </div>

                  <div className="mt-5 grid md:grid-cols-2 gap-5">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs text-emerald-300/90 font-semibold tracking-wide">
                        Puntos clave
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-gray-100">
                        {step.bullets.map((b, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-emerald-400/80 shrink-0" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs text-emerald-300/90 font-semibold tracking-wide">
                        Ejemplo
                      </p>
                      <p className="mt-2 text-sm text-gray-100">
                        {step.example?.caption}
                      </p>

                      {step.example?.imageSrc && (
                        <div className="mt-3 relative w-full h-[180px] rounded-xl overflow-hidden border border-white/10">
                          <Image
                            src={step.example.imageSrc}
                            alt="Ejemplo"
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}

                      {!step.example?.imageSrc && (
                        <div className="mt-3 text-xs text-gray-400">
                          (Opcional) agrega una imagen en /public/prototipado/...
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 text-[11px] text-gray-400">
                    Consejo: si un cambio sube la incertidumbre técnica, no es
                    “fracaso”: es señal de stepdown.
                  </div>
                </div>

                <div className="mt-4 text-center text-xs text-gray-500">
                  {idx + 1} / {steps.length}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
