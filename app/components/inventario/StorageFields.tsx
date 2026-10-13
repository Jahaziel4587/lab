"use client";
import type { InventoryComponent } from "@/lib/inventario/types";
import { Field, inputClass } from "./InventoryShell";
export default function StorageFields({ component, optional = false }: { component: InventoryComponent; optional?: boolean }) {
  return <div className="space-y-3 sm:col-span-2"><p className="text-sm font-semibold">Condiciones de almacenamiento</p>
    <p className="text-xs text-white/50">{optional ? "Se prellenan si el componente tiene información. Puedes dejarlas vacías; vacío o N/A no cambia las condiciones del componente." : "Si las cambias, se guardarán para lotes futuros y el almacenista recibirá una revisión de los lotes existentes."}</p>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Temperatura (°C)"><input required={!optional} name="temperatureCondition" defaultValue={optional && /^(n\s*\/?\s*a|no aplica)$/i.test(component.temperatureCondition || "") ? "" : component.temperatureCondition || ""} maxLength={200} className={inputClass} placeholder="Ej. 15–30 o N/A" /></Field>
    <Field label="Humedad (%HR)"><input required={!optional} name="humidityCondition" defaultValue={optional && /^(n\s*\/?\s*a|no aplica)$/i.test(component.humidityCondition || "") ? "" : component.humidityCondition || ""} maxLength={200} className={inputClass} placeholder="Ej. debajo de 60 o N/A" /></Field></div>
  </div>;
}
