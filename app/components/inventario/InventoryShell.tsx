"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Boxes, ClipboardList } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/src/firebase/firebaseConfig";
import { inventoryRequest } from "@/lib/inventario/service";
import { useInventorySite } from "./InventoryProvider";
import { INVENTORY_SITES, inventoryHref } from "@/lib/inventario/sites";
import type { InventoryComponent, Voucher } from "@/lib/inventario/types";
export const inputClass = "min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/15 disabled:opacity-50 sm:rounded-2xl [&>option]:bg-[#171b19] [&>option]:text-white";
export const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40";
export const secondaryButtonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40";
export const panelClass = "min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-xl sm:rounded-3xl sm:p-6";
export function useInventory() {
  const router = useRouter();
  const { site } = useInventorySite();
  const [data, setData] = useState<{ components: InventoryComponent[]; vouchers: Voucher[] }>({ components: [], vouchers: [] });
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  async function reload() { try { setData(await inventoryRequest(undefined, "", site)); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Error al cargar."); } finally { setLoading(false); } }
  useEffect(() => onAuthStateChanged(auth, u => { if (!u) { setData({ components: [], vouchers: [] }); router.replace("/login"); } else void reload(); }), [router, site]);
  return { ...data, loading, error, reload };
}
export default function InventoryShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { site, changeSite } = useInventorySite();
  const detail = pathname !== "/inventario" && pathname !== "/inventario/movimientos";
  return <main className="mx-auto max-w-7xl space-y-6 px-3 py-5 text-white sm:px-8 sm:py-10"><nav className="flex flex-wrap items-center justify-between gap-3 print-hide"><Link href={detail ? inventoryHref("/inventario", site) : "/"} className={`${secondaryButtonClass} !rounded-full`}><ArrowLeft size={15} />{detail ? "Regresar al inventario" : "Volver"}</Link><div className="flex rounded-2xl border border-white/10 bg-white/[0.035] p-1 backdrop-blur-xl">{[{ href: "/inventario", label: "Inventario", Icon: Boxes }, { href: "/inventario/movimientos", label: "Movimientos y vales", Icon: ClipboardList }].map(({ href, label, Icon }) => { const active = href === "/inventario" ? !pathname.includes("/movimientos") && !pathname.includes("/vales/") : pathname.includes("/movimientos") || pathname.includes("/vales/"); return <Link key={href} href={inventoryHref(href, site)} aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm ${active ? "bg-emerald-400/10 text-emerald-300" : "text-white/55 hover:bg-white/[0.05] hover:text-white"}`}><Icon className="hidden sm:block" size={16} />{label}</Link>; })}</div></nav><section className="print-hide rounded-2xl border border-white/10 bg-white/[0.035] p-3 backdrop-blur-xl sm:rounded-3xl sm:p-4"><div className="grid grid-cols-2 gap-2">{INVENTORY_SITES.map(s => <button key={s.id} aria-pressed={site === s.id} onClick={() => { if (site !== s.id) changeSite(s.id); }} className={`min-h-16 rounded-xl border px-3 py-3 text-left transition sm:px-5 ${site === s.id ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/[0.025] text-white/60 hover:bg-white/[0.06]"}`}><span className="block text-sm font-semibold">{s.label}</span><span className="mt-1 block text-xs opacity-60">{s.description}</span></button>)}</div></section>{children}</main>;
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block min-w-0 space-y-1.5 text-sm"><span className="text-xs font-medium text-white/55">{label}</span>{children}</label>; }
