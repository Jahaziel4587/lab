"use client";

import { ClipboardCheck, Factory } from "lucide-react";
import { useRouter } from "next/navigation";
import InspectionOptionCard from "./components/InspectionOptionCard";
import {
  inspectionPageClass,
  inspectionPanelClass,
} from "./styles";

export default function InspectionsPage() {
  const router = useRouter();

  return (
    <main className={inspectionPageClass}>
      <section className={inspectionPanelClass}>
        <div>
          <p
            className="text-xs font-semibold uppercase
              tracking-[0.22em] text-emerald-300"
          >
            Quality
          </p>

          <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
            Inspecciones
          </h1>

          <p
            className="mt-3 max-w-2xl text-sm leading-relaxed
              text-white/65 sm:text-base"
          >
            Selecciona el tipo de inspección que estás realizando.
          </p>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2">
          <InspectionOptionCard
            title="Inspección de entrada"
            description={
              "Consulta componentes MTS o componentes específicos " +
              "de los proyectos."
            }
            icon={ClipboardCheck}
            onClick={() => router.push("/inspecciones/entrada")}
          />

          <InspectionOptionCard
            title="Inspección de proceso"
            description={
              "Consulta las instrucciones de proceso y registra " +
              "hallazgos en ensambles o subensambles."
            }
            icon={Factory}
            onClick={() => router.push("/inspecciones/proceso")}
          />
        </div>
      </section>
    </main>
  );
}