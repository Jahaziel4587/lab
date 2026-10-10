"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { auth } from "@/src/firebase/firebaseConfig";
import { useInventorySite } from "./InventoryProvider";
import { secondaryButtonClass } from "./InventoryShell";
export default function InventoryDownload() {
    const { site } = useInventorySite();
    const [busy, setBusy] = useState(false), [error, setError] = useState("");
    return <div><button className={secondaryButtonClass} disabled={busy} title={`Descargar todas las existencias del Almacén ${site}`} onClick={async () => {
            setBusy(true);
            setError("");
            try {
                if (!auth.currentUser)
                    throw new Error("Inicia sesión.");
                const response = await fetch(`/api/inventario/exportar?site=${site}`, { cache: "no-store", headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` } });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || "No se pudo descargar.");
                }
                const url = URL.createObjectURL(await response.blob());
                const link = document.createElement("a");
                link.href = url;
                link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || `Almacenes-${site}.xlsx`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
            catch (e) {
                setError(e instanceof Error ? e.message : "No se pudo descargar.");
            }
            finally {
                setBusy(false);
            }
        }}><Download size={16}/>{busy ? "Descargando…" : "Descargar Excel"}</button>{error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}</div>;
}
