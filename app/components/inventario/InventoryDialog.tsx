"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function InventoryDialog({ title, onClose, children }: {
  title: string; onClose: () => void; children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return createPortal(<dialog ref={dialog} aria-label={title}
    onCancel={event => { event.preventDefault(); onClose(); }}
    className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0d1512] p-5 text-white shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm sm:p-7">
    <div className="mb-4 flex items-center justify-between gap-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Inventario</p>
      <button type="button" onClick={onClose} aria-label="Cerrar ventana"
        className="rounded-xl border border-white/10 p-2 text-white/60 hover:bg-white/5 focus-visible:outline-emerald-300"><X size={18} /></button>
    </div>
    <div className="[&>form]:rounded-none [&>form]:border-0 [&>form]:bg-transparent [&>form]:p-0 [&>form]:backdrop-blur-none">{children}</div>
  </dialog>, document.body);
}
