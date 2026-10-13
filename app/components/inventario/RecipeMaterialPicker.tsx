"use client";
import {useRef,useState} from "react";
import type {InventoryComponent} from "@/lib/inventario/types";
import {availableRecipeQuantity,filterRecipeMaterials} from "@/lib/inventario/recipe-materials";
import {inputClass} from "./InventoryShell";
export default function RecipeMaterialPicker({components,value,onChange,disabled}:{components:InventoryComponent[];value:string;onChange:(id:string)=>void;disabled:boolean}) {
  const [query,setQuery]=useState("");const details=useRef<HTMLDetailsElement>(null);
  const selected=components.find(c=>c.id===value),filtered=filterRecipeMaterials(components,query);
  return <div className="min-w-0 space-y-2"><details ref={details} className="rounded-xl border border-white/10 bg-white/[0.025]">
    <summary aria-disabled={disabled} onClick={e=>{if(disabled)e.preventDefault();}} className="cursor-pointer break-words p-3 text-sm">{selected?`${selected.code} · ${selected.name}`:"Buscar componente o MTS"}</summary>
    <div className="space-y-2 border-t border-white/10 p-3"><input aria-label="Buscar material por código o nombre" disabled={disabled} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")e.preventDefault();}} placeholder="Escribe código o nombre…" className={inputClass}/><p className="text-xs text-white/45">{filtered.length} resultados · incluye materiales sin existencias</p>
      <div className="max-h-56 space-y-1 overflow-y-auto">{!filtered.length&&<p role="status" className="py-3 text-sm text-white/50">No se encontraron materiales.</p>}{filtered.map(c=>{const available=availableRecipeQuantity(c);return <button type="button" key={c.id} disabled={disabled} aria-pressed={value===c.id} onClick={()=>{onChange(c.id);setQuery("");if(details.current)details.current.open=false;}} className={`block w-full rounded-lg border p-3 text-left text-sm ${value===c.id?"border-emerald-300/30 bg-emerald-400/10":"border-transparent hover:bg-white/5"}`}><span className="block break-words">{c.code} · {c.name}</span><span className={`mt-1 block text-xs ${available>0?"text-white/50":"text-amber-200"}`}>{available>0?`${available} ${c.unit} disponibles`:"Sin existencias disponibles"}</span></button>;})}</div>
    </div></details>{selected&&<p className={`text-xs ${availableRecipeQuantity(selected)>0?"text-white/50":"text-amber-200"}`}>{availableRecipeQuantity(selected)>0?`Disponible: ${availableRecipeQuantity(selected)} ${selected.unit}`:"Sin existencias disponibles. Puedes guardar este material en la receta; se verificará su disponibilidad al retirar."}</p>}
  </div>;
}
