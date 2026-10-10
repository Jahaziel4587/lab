import { Suspense } from "react";
import InventoryProvider from "@/app/components/inventario/InventoryProvider";
export default function Layout({ children }: {
    children: React.ReactNode;
}) { return <Suspense fallback={<main className="p-8 text-white">Cargando inventario…</main>}><InventoryProvider>{children}</InventoryProvider></Suspense>; }
