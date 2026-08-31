"use client";

import { useState } from "react";
import SpotlightTour from "@/app/components/SpotlightTour";
import Image from "next/image";
import { motion } from "framer-motion";

export default function AdamTutorialCard() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className="mt-3 sm:mt-4 rounded-2xl sm:rounded-3xl border border-white/10
          bg-white/[0.04] backdrop-blur-xl
          shadow-[0_20px_80px_-40px_rgba(0,0,0,0.8)]
          p-4 sm:p-6 overflow-hidden"
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <div
            className="relative shrink-0 w-[76px] h-[92px]
              sm:w-[140px] sm:h-[140px] sm:-mt-2"
          >
            <div className="absolute inset-0 rounded-2xl bg-emerald-400/10 blur-2xl" />

            <motion.div
              className="absolute inset-0"
              animate={{
                y: [0, -7, 0],
                rotate: [0, -1, 0, 1, 0],
              }}
              transition={{
                duration: 4.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Image
                src="/adam.png"
                alt="ADAM"
                fill
                sizes="(max-width: 640px) 76px, 140px"
                className="object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.6)]"
                priority
              />
            </motion.div>

            <motion.span
              className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-300/80"
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white/90">
              Hi, I'm A.D.A.M.
            </div>

            <p className="mt-1 text-xs sm:text-sm text-white/70 leading-relaxed">
              Your Prototyping Assistant. I can guide you through the platform
              step-by-step.
            </p>

            <button
              type="button"
              className="mt-3 min-h-11 rounded-xl sm:rounded-2xl
                bg-emerald-400/90 px-4 py-2 text-sm font-semibold text-black
                hover:bg-emerald-400 hover:brightness-110 transition"
              onClick={() => setOpen(true)}
            >
              Start Tutorial
            </button>
          </div>
        </div>
      </div>

      <SpotlightTour open={open} onClose={() => setOpen(false)} />
    </>
  );
}