export const INVENTORY_SITES = [
    { id: "B1", label: "Almacén B1", description: "Oficina Bioana 1" },
    { id: "B2", label: "Almacén B2", description: "Planta Bioana 2" },
] as const;
export type InventorySite = "B1" | "B2";
export function inventorySite(value: unknown): InventorySite {
    if (value === undefined || value === null || value === "")
        return "B1";
    if (value !== "B1" && value !== "B2")
        throw new Error("Selecciona Almacén B1 o Almacén B2.");
    return value;
}
export function inventoryCollections(site: InventorySite) {
    const prefix = site === "B1" ? "inventario" : "inventario_b2";
    return { components: `${prefix}_componentes`, vouchers: `${prefix}_vales`, operations: `${prefix}_operaciones` };
}
export function inventoryHref(path: string, site: InventorySite) {
    return `${path}${path.includes("?") ? "&" : "?"}site=${site}`;
}
