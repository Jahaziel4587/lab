"use client";

import Link from "next/link";
import { fmtMXN } from "../../../utils";

type ProyectoHeaderProps = {
  proyecto: string;
  totalProyectoMXN: number;
  isAdmin: boolean;
  onCompartir: () => void;
};

export default function ProyectoHeader({
  proyecto,
  totalProyectoMXN,
  isAdmin,
  onCompartir,
}: ProyectoHeaderProps) {
  return (
    <>
      <div
        className="flex flex-col gap-4
          lg:flex-row lg:items-center
          lg:justify-between"
      >
        <Link
          href="/calendario"
          className="inline-flex self-start
            items-center gap-2 rounded-full
            border border-white/15 bg-white/5
            px-4 py-2 text-sm text-white/90
            transition hover:bg-white/10"
        >
          ← Volver
        </Link>

        <h1
          className="break-words text-2xl
            font-semibold tracking-tight
            sm:text-3xl"
        >
          Pedidos fechados ·{" "}
          <span className="text-white/80">
            {proyecto}
          </span>
        </h1>

        {isAdmin && (
          <button
            type="button"
            onClick={onCompartir}
            className="inline-flex self-start
              items-center justify-center
              rounded-full border border-white/15
              bg-white/5 px-4 py-2 text-sm
              text-white/90 transition
              hover:bg-white/10 lg:self-auto"
          >
            Compartir proyecto
          </button>
        )}
      </div>

      <div className="mt-4 text-sm text-white/70">
        <span className="font-semibold text-white/80">
          Total gastado, subtotal base:
        </span>{" "}
        {fmtMXN(totalProyectoMXN)}
      </div>
    </>
  );
}