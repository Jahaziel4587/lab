"use client";
import { inventorySite, type InventorySite } from "@/lib/inventario/sites";
import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { secondaryButtonClass } from "./InventoryShell";
import { ScanLine, X } from "lucide-react";
export default function QrScanner({ onScan }: { onScan: (id: string, site?: InventorySite) => void }) {
  const video = useRef<HTMLVideoElement>(null); const callback = useRef(onScan); callback.current = onScan;
  const [active, setActive] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    if (!active || !video.current) return;
    let disposed = false, handled = false; let controls: IScannerControls | undefined;
    const reader = new BrowserQRCodeReader();
    reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } }, audio: false }, video.current, (result, _err, ctl) => {
      if (!result || handled || disposed) return;
      try { const url = new URL(result.getText()); const match = url.pathname.match(/^\/inventario\/components\/([a-f0-9]{64})\/?$/);
        if (!match || url.origin !== window.location.origin) throw new Error("Escanea un QR de componente de esta plataforma.");
        const site = inventorySite(url.searchParams.get("site"));
        handled = true; ctl.stop(); setActive(false); callback.current(match[1], site);
      } catch (e) { setError(e instanceof Error ? e.message : "QR inválido."); }
    }).then(c => { controls = c; if (disposed) c.stop(); }).catch(() => { if (!disposed) { setError("No se pudo abrir la cámara. Revisa el permiso o selecciona el artículo manualmente."); setActive(false); } });
    return () => { disposed = true; controls?.stop(); const stream = video.current?.srcObject as MediaStream | null; stream?.getTracks().forEach(t => t.stop()); };
  }, [active]);
  return <div className="space-y-3"><button className={secondaryButtonClass} type="button" onClick={() => { setError(""); setActive(!active); }}>{active ? <X size={16} /> : <ScanLine size={16} />}{active ? "Cerrar cámara" : "Escanear QR"}</button>{active && <video ref={video} muted playsInline className="max-h-72 w-full rounded-2xl border border-white/10 bg-black" />}{error && <p role="alert" className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-200">{error}</p>}</div>;
}
