"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { InventoryComponent } from "@/lib/inventario/types";
import { panelClass } from "./InventoryShell";
export default function LotQrLabel({ component }: { component: InventoryComponent }) {
  const [src, setSrc] = useState(""), [error, setError] = useState("");
  useEffect(() => { let live = true; QRCode.toDataURL(`${window.location.origin}/inventario/components/${component.id}`, { width: 360, margin: 4, errorCorrectionLevel: "M" }).then(s => { if (live) setSrc(s); }).catch(() => { if (live) setError("No se pudo generar el QR."); }); return () => { live = false; }; }, [component.id]);
  return <section className={`${panelClass} space-y-3`}><h2 className="text-lg font-semibold">QR del componente</h2><p className="text-sm text-white/60">El mismo QR muestra todos los lotes de este artículo. Para etiquetas permanentes, genera el QR desde el dominio de producción.</p>{src && <><div className="inline-block rounded-xl bg-white p-4 text-center text-black"><img src={src} alt={`QR de ${component.code}`} width={180} height={180} /><strong>{component.code}</strong><p className="max-w-48 text-sm">{component.name}</p></div><p><a download={`QR-${component.code.replace(/[^a-zA-Z0-9-]/g, "_")}.png`} href={src} className="text-emerald-300 underline">Descargar QR PNG</a> · <button onClick={() => {
    const w = window.open("", "_blank"); if (!w) { setError("Permite abrir la ventana de impresión."); return; }
    const doc = w.document; doc.title = `Etiqueta ${component.code}`; const img = doc.createElement("img"); img.src = src; img.width = 220;
    const title = doc.createElement("h2"); title.textContent = component.code; const text = doc.createElement("p"); text.textContent = component.name;
    doc.body.style.cssText = "font-family:Arial;text-align:center"; doc.body.append(img, title, text); img.onload = () => w.print();
  }} className="text-emerald-300 underline">Imprimir etiqueta</button></p></>}{error && <p role="alert">{error}</p>}</section>;
}
