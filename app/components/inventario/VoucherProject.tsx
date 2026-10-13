"use client";
import { useProjects } from "@/lib/operacional/client";
import { Field, inputClass } from "./InventoryShell";
export default function VoucherProject({ disabled = false }: { disabled?: boolean }) {
  const { projects, error } = useProjects();
  return <Field label="Proyecto / proceso del vale"><select name="project" disabled={disabled} defaultValue="000.General" className={inputClass}><option value="000.General">000.General</option>{projects.filter(p => p.code !== "000" && p.code !== "OTRO").map(p => <option key={p.code} value={p.label}>{p.label}</option>)}</select>{error && <span role="alert" className="block text-xs text-red-300">{error}</span>}</Field>;
}
