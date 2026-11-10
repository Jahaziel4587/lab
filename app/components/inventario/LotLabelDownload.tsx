"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { auth } from "@/src/firebase/firebaseConfig";
import { inventoryHref } from "@/lib/inventario/sites";
import { useInventorySite } from "./InventoryProvider";
import { secondaryButtonClass } from "./InventoryShell";

export default function LotLabelDownload({ componentId, code, lotId, lotName }: {
  componentId: string;
  code: string;
  lotId: string;
  lotName: string;
}) {
  const { site } = useInventorySite();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setBusy(true);
    setError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Inicia sesión para descargar la etiqueta.");
      const url = inventoryHref(`/api/inventario/components/${componentId}/lotes/${lotId}/etiqueta`, site);
      const response = await fetch(url, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "No se pudo descargar la etiqueta P-touch.");
      }
      const href = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = href;
      link.download = `Etiqueta-${site}-${code}-${lotName}`.replace(/[^\p{L}\p{N}._-]/gu, "_").slice(0, 150) + ".lbx";
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo descargar la etiqueta P-touch.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="ml-auto max-w-full text-right">
    <button type="button" className={secondaryButtonClass} disabled={busy} onClick={download}>
      <Download size={15} />{busy ? "Generando etiqueta…" : "Descargar etiqueta P-touch"}
    </button>
    {error && <p role="alert" className="mt-2 max-w-60 break-words text-xs text-red-300">{error}</p>}
  </div>;
}
