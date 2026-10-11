"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Factory, PackagePlus, ScanLine, ArrowRight } from "lucide-react";
import QrScanner from "@/app/components/inventario/QrScanner";
import { inventoryHref } from "@/lib/inventario/sites";

const cardClass = "rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:rounded-3xl sm:p-7";
const accessClass = `${cardClass} group flex flex-col transition hover:border-emerald-300/30 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400`;

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-[calc(100vh-140px)]">
      <main className="mx-auto max-w-6xl px-4 py-6 text-white sm:px-8 sm:py-14">
        <section aria-label="Prototipado e inventario" className="grid grid-cols-1 items-start gap-5 sm:gap-8 md:grid-cols-2">
          <Link href="/hacer-pedido/proyecto" data-tutorial="card-place-order" className={accessClass}>
            <PackagePlus className="mb-5 text-emerald-300" size={30} aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Prototyping Lab</p>
            <h2 className="mt-2 text-xl font-semibold">Place Order</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/60">Selecciona proyecto, servicio, técnica, material y especificaciones para realizar tu pedido.</p>
            <span className="mt-6 flex items-center gap-2 text-sm font-medium text-emerald-300">Realizar pedido <ArrowRight size={16} aria-hidden="true" /></span>
          </Link>

          <div className={cardClass}>
            <ScanLine className="mb-5 text-emerald-300" size={30} aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Inventory</p>
            <h2 className="mt-2 text-xl font-semibold">Escanear QR de inventario</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/60">Escanea la etiqueta de un componente para abrir su información en Inventory B1 o B2.</p>
            <div className="mt-6">
              <QrScanner onScan={(id, site) => router.push(inventoryHref(`/inventario/components/${id}`, site || "B1"))} />
            </div>
          </div>
        </section>

        <section aria-labelledby="quality-heading" className="mt-8 sm:mt-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Quality</p>
          <h2 id="quality-heading" className="mt-2 text-xl font-semibold sm:text-2xl">Inspecciones</h2>
          <p className="mt-2 text-sm text-white/60">Accede directamente al tipo de inspección que necesitas.</p>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:gap-8 md:grid-cols-2">
            <Link href="/inspecciones/entrada" className={accessClass}>
              <ClipboardCheck className="mb-5 text-emerald-300" size={30} aria-hidden="true" />
              <h3 className="text-xl font-semibold">Inspección de entrada</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/60">Consulta componentes y lotes, registra hallazgos y genera reportes de inspección de entrada.</p>
              <span className="mt-6 flex items-center gap-2 text-sm font-medium text-emerald-300">Abrir inspecciones de entrada <ArrowRight size={16} aria-hidden="true" /></span>
            </Link>

            <Link href="/inspecciones/proceso" className={accessClass}>
              <Factory className="mb-5 text-emerald-300" size={30} aria-hidden="true" />
              <h3 className="text-xl font-semibold">Inspección de proceso</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/60">Consulta instrucciones y componentes de los proyectos para registrar y dar seguimiento a hallazgos de proceso.</p>
              <span className="mt-6 flex items-center gap-2 text-sm font-medium text-emerald-300">Abrir inspecciones de proceso <ArrowRight size={16} aria-hidden="true" /></span>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
