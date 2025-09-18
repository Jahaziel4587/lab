import { Suspense } from "react";
import CotizadorClient from "./CotizadorClient";

// Opcional: si /cotizador depende de params y no quieres prerender
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Cargando cotizador…</div>}>
      <CotizadorClient />
    </Suspense>
  );
}

