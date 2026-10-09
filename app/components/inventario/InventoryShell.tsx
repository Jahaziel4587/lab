"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/src/firebase/firebaseConfig";
import { inventoryRequest } from "@/lib/inventario/service";
import type { InventoryComponent, Voucher } from "@/lib/inventario/types";
export const inputClass = "w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-white";
export const buttonClass = "rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-40";
export const panelClass = "rounded-2xl border border-white/15 bg-slate-900/80 p-5";
export function useInventory() {
  const router = useRouter();
  const [data, setData] = useState<{ components: InventoryComponent[]; vouchers: Voucher[] }>({ components: [], vouchers: [] });
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  async function reload() { try { setData(await inventoryRequest()); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Error al cargar."); } finally { setLoading(false); } }
  useEffect(() => onAuthStateChanged(auth, u => { if (!u) { setData({ components: [], vouchers: [] }); router.replace("/login"); } else void reload(); }), [router]);
  return { ...data, loading, error, reload };
}
export default function InventoryShell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-6xl space-y-5 px-4 py-8 text-white"><nav className="flex flex-wrap gap-4 text-emerald-300"><Link href="/inventario">Inventario</Link><Link href="/inventario/movimientos">Movimientos y vales</Link><Link href="/">Inicio</Link></nav>{children}</main>;
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1 text-sm"><span className="text-white/70">{label}</span>{children}</label>; }
