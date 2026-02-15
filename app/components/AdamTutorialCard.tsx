"use client";

import { useState } from "react";
import SpotlightTour from "@/app/components/SpotlightTour";
import Image from "next/image";
import { motion } from "framer-motion";

export default function AdamTutorialCard() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_20px_80px_-40px_rgba(0,0,0,0.8)] p-5 sm:p-6 overflow-hidden">
        <div className="flex items-start gap-4">
          {/* ADAM flotando */}
          <div className="relative shrink-0 w-[110px] h-[110px] sm:w-[140px] sm:h-[140px] -mt-2">
            {/* glow */}
            <div className="absolute inset-0 rounded-2xl bg-emerald-400/10 blur-2xl" />

            <motion.div
              className="absolute inset-0"
              animate={{ y: [0, -10, 0], rotate: [0, -1, 0, 1, 0] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Image
                src="/adam.png"
                alt="ADAM"
                fill
                className="object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.6)]"
                priority
              />
            </motion.div>

            {/* sparkle opcional (puntito) */}
            <motion.span
              className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-300/80"
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          {/* Texto */}
          <div className="flex-1">
            <div className="text-sm font-semibold text-white/90">Hi, I'm A.D.A.M.</div>
            <p className="mt-1 text-sm text-white/70 leading-relaxed">
              Your Prototyping Assistant. If you need a quick tutorial on how the
              platform works, I can guide you step-by-step.
            </p>

            <div className="mt-3 flex gap-2">
              <button
                className="rounded-2xl bg-emerald-400/90 px-4 py-2 text-sm font-semibold text-black
                  hover:bg-emerald-400 hover:brightness-110 transition"
                onClick={() => setOpen(true)}
              >
                Start Tutorial
              </button>
            </div>
          </div>
        </div>
      </div>

      <SpotlightTour open={open} onClose={() => setOpen(false)} />
    </>
  );
}
