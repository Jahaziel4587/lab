"use client";
import { Suspense } from "react";
import ContenidoListado from "./ContenidoListado";

export default function ListadoPedidosPage() {
  return (
    <Suspense fallback={<div className="text-center py-10">Cargando...</div>}>
      <ContenidoListado />
    </Suspense>
  );
}