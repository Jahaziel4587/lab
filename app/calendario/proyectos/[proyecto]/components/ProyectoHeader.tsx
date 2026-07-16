"use client";

import Link from "next/link";
import { fmtMXN } from "../../../utils";

type ProyectoHeaderProps = {
  proyecto: string;
  totalProyectoMXN: number;
  onCompartir: () => void;
};

export default function ProyectoHeader({
  proyecto,
  totalProyectoMXN,
  onCompartir,
}: ProyectoHeaderProps) {
  return (
    <>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <Link
          href="/calendario"
          className="inline-flex self-start items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10 transition"
        >
          ← Volver
        </Link>

        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Pedidos fechados ·{" "}
          <span className="text-white/80">{proyecto}</span>
        </h1>

        <button
          type="button"
          onClick={onCompartir}
          className="inline-flex self-start lg:self-auto items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10 transition"
        >
          Compartir proyecto
        </button>
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