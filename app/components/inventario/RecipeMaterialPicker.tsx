"use client";
import {useEffect,useId,useState} from "react";
import type {InventoryComponent} from "@/lib/inventario/types";
import {availableRecipeQuantity,filterRecipeMaterials} from "@/lib/inventario/recipe-materials";
import {inputClass} from "./InventoryShell";
export default function RecipeMaterialPicker({components,value,onChange,disabled}:{components:InventoryComponent[];value:string;onChange:(id:string)=>void;disabled:boolean}) {
  const [query,setQuery]=useState(""),[editing,setEditing]=useState(false),[open,setOpen]=useState(false),[highlight,setHighlight]=useState(-1);
  useEffect(()=>{if(value){setEditing(false);setQuery("");setOpen(false);setHighlight(-1);}},[value]);
  const listId=useId(),selected=components.find(c=>c.id===value),filtered=filterRecipeMaterials(components,query);
  const show=open&&editing&&!!query.trim()&&!disabled;
  function choose(component:InventoryComponent){onChange(component.id);setEditing(false);setQuery("");setOpen(false);setHighlight(-1);}
  return <div className="min-w-0 space-y-2" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}>
    <div className="relative"><input role="combobox" aria-label="Buscar componente o MTS" aria-autocomplete="list" aria-expanded={show} aria-controls={show?listId:undefined} aria-activedescendant={show&&highlight>=0&&filtered[highlight]?`${listId}-${highlight}`:undefined}
      disabled={disabled} autoComplete="off" placeholder="Buscar componente o MTS" className={inputClass} value={editing?query:selected?`${selected.code} · ${selected.name}`:""}
      onFocus={e=>{setOpen(true);if(selected&&!editing)e.currentTarget.select();}}
      onChange={e=>{setQuery(e.target.value);setEditing(true);setOpen(true);setHighlight(-1);if(value)onChange("");}}
      onKeyDown={e=>{
        if(e.key==="Escape"&&show){e.preventDefault();e.stopPropagation();setOpen(false);}
        if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();setOpen(true);setHighlight(i=>Math.max(0,Math.min(filtered.length-1,i+(e.key==="ArrowDown"?1:-1))));}
        if(e.key==="Enter"){e.preventDefault();if(show&&filtered.length)choose(filtered[Math.max(0,highlight)]);}
      }}/>
      {show&&<div id={listId} role="listbox" aria-label="Sugerencias de materiales" className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-white/15 bg-[#0d1512] p-1 shadow-2xl">
        {!filtered.length&&<p role="status" className="p-3 text-sm text-white/50">No se encontraron materiales.</p>}
        {filtered.map((c,i)=>{const available=availableRecipeQuantity(c);return <div key={c.id} id={`${listId}-${i}`} role="option" aria-selected={highlight===i} onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setHighlight(i)} onClick={()=>choose(c)} className={`cursor-pointer rounded-lg p-3 text-sm ${highlight===i?"bg-emerald-400/10":"hover:bg-white/5"}`}><span className="block break-words">{c.code} · {c.name}</span><span className={`mt-1 block text-xs ${available>0?"text-white/50":"text-amber-200"}`}>{available>0?`${available} ${c.unit} disponibles`:"Sin existencias disponibles"}</span></div>;})}
      </div>}
    </div>
    {selected&&<p className={`text-xs ${availableRecipeQuantity(selected)>0?"text-white/50":"text-amber-200"}`}>{availableRecipeQuantity(selected)>0?`Disponible: ${availableRecipeQuantity(selected)} ${selected.unit}`:"Sin existencias disponibles. Puedes guardar este material en la receta; se verificará su disponibilidad al retirar."}</p>}
  </div>;
}
