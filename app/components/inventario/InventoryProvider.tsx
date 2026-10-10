"use client";
import { createContext, useContext } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { inventorySite, type InventorySite } from "@/lib/inventario/sites";
const SiteContext = createContext<{
    site: InventorySite;
    changeSite: (site: InventorySite) => void;
}>({ site: "B1", changeSite: () => { } });
export function useInventorySite() { return useContext(SiteContext); }
export default function InventoryProvider({ children }: {
    children: React.ReactNode;
}) {
    const params = useSearchParams();
    const router = useRouter();
    const value = params.get("site");
    const valid = !value || value === "B1" || value === "B2";
    if (!valid)
        return <main className="p-8 text-white">Almacén inválido. <a href="/inventario?site=B1" className="text-emerald-300 underline">Abrir Almacén B1</a></main>;
    const site = inventorySite(value);
    return <SiteContext.Provider value={{ site, changeSite: next => router.push(`/inventario?site=${next}`) }}><div key={site}>{children}</div></SiteContext.Provider>;
}
