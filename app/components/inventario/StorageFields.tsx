"use client";
import type { InventoryComponent } from "@/lib/inventario/types";
import { Field, inputClass } from "./InventoryShell";
export default function StorageFields({ component }: { component: InventoryComponent }) {
  return <div className="space-y-3 sm:col-span-2"><p className="text-sm font-semibold">Condiciones de almacenamiento</p>
    <p className="text-xs text-white/50">Se prellenan desde el componente. Si las cambias, se guardarán para lotes futuros y el almacenista recibirá una revisión de los lotes existentes. Usa N/A si no aplica.</p>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Temperatura (°C)"><input required name="temperatureCondition" defaultValue={component.temperatureCondition || ""} maxLength={200} className={inputClass} placeholder="Ej. 15–30 o N/A" /></Field>
    <Field label="Humedad (%HR)"><input required name="humidityCondition" defaultValue={component.humidityCondition || ""} maxLength={200} className={inputClass} placeholder="Ej. debajo de 60 o N/A" /></Field></div>
  </div>;
}
