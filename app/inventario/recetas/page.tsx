"use client";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import InventoryShell,{useInventory,Field,panelClass,inputClass,buttonClass,secondaryButtonClass} from "@/app/components/inventario/InventoryShell";
import RecipeMaterialPicker from "@/app/components/inventario/RecipeMaterialPicker";
import InventoryDialog from "@/app/components/inventario/InventoryDialog";
import VoucherProject from "@/app/components/inventario/VoucherProject";
import {useInventorySite} from "@/app/components/inventario/InventoryProvider";
import {opsRequest} from "@/lib/operacional/client";
import {inventoryRequest} from "@/lib/inventario/service";
import {inventoryHref,voucherDestination} from "@/lib/inventario/sites";
import {WAREHOUSES} from "@/lib/inventario/catalogs";
import {mexicoToday,selectLot,lotAvailableForProject} from "@/lib/inventario/selection";
import {type FixedRecipe} from "@/lib/inventario/fixed-recipes";
type RecipeWithdrawal = Pick<FixedRecipe, "id" | "title" | "startDate" | "intervalDays" | "version"> & {
 lines: Array<{componentId:string;quantity:string;included:boolean}>;
};
const blank=():FixedRecipe=>({id:"",title:"",startDate:mexicoToday(),intervalDays:7,active:true,version:0,lines:[]});
export default function FixedRecipes(){
 const {site}=useInventorySite(),{components,loading,error:inventoryError}=useInventory(),router=useRouter();
 const [recipes,setRecipes]=useState<FixedRecipe[]>([]),[edit,setEdit]=useState<FixedRecipe|null>(null),[run,setRun]=useState<RecipeWithdrawal|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[revision,setRevision]=useState(0);
 const pendingWithdrawal=useRef<{signature:string;id:string}|null>(null);
 useEffect(()=>{if(loading)return;let live=true;setRecipes([]);setError("");opsRequest(`/api/inventario/recipes?site=${site}`).then(d=>{if(live)setRecipes(d.recipes);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[site,revision,loading]);
 return <InventoryShell><div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-3xl font-semibold">Recetas fijas</h1><p className="mt-2 text-sm text-white/50">Accesos rápidos a retiros frecuentes. La frecuencia se usa para prever faltantes de material.</p></div><button className={buttonClass} onClick={()=>setEdit(blank())}>Nueva receta</button></div>
 {(error||inventoryError)&&<p role="alert" className="text-red-300">{error||inventoryError}</p>}
 {loading?<p>Cargando materiales…</p>:!recipes.length?<p className={panelClass}>Todavía no hay recetas.</p>:recipes.map(r=><section key={r.id} className={`${panelClass} space-y-3`}><h2 className="text-lg font-semibold">{r.title}</h2><p className="text-sm text-white/50">Desde {r.startDate} · sin fecha de fin · cada {r.intervalDays} días · {r.active?"Activa":"Pausada"}</p>{r.lines.map(l=>{const c=components.find(c=>c.id===l.componentId);return <p key={l.componentId} className="text-sm">{c?.code} · {c?.name} · {l.quantity} {c?.unit}</p>;})}<div className="flex flex-wrap gap-2"><button className={secondaryButtonClass} onClick={()=>setEdit({...r,lines:r.lines.map(l=>({...l}))})}>Editar receta</button><button disabled={!r.active} className={buttonClass} onClick={()=>{pendingWithdrawal.current=null;setError("");setRun({...r,lines:r.lines.map(l=>({...l,quantity:String(l.quantity),included:true}))});}}>Registrar retiro</button></div></section>)}
 {edit&&<InventoryDialog title="Receta fija" onClose={()=>{if(!busy)setEdit(null);}}><form className="space-y-4" onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{await opsRequest("/api/inventario/recipes",{...edit,site,id:edit.id||undefined});setEdit(null);setRevision(n=>n+1);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><h2 className="text-xl font-semibold">{edit.id?"Editar receta":"Nueva receta"}</h2>
 <Field label="Título"><input required maxLength={200} disabled={busy} value={edit.title} onChange={e=>setEdit({...edit,title:e.target.value})} className={inputClass}/></Field>
 <div className="grid gap-3 sm:grid-cols-2"><Field label="Inicio"><input required type="date" disabled={busy} value={edit.startDate} onChange={e=>setEdit({...edit,startDate:e.target.value})} className={inputClass}/></Field></div>
 <Field label="Repetir cada (días)"><input required type="number" min={1} max={3650} disabled={busy} value={edit.intervalDays} onChange={e=>setEdit({...edit,intervalDays:Number(e.target.value)})} className={inputClass}/></Field>
 <label className="flex gap-2"><input type="checkbox" disabled={busy} checked={edit.active} onChange={e=>setEdit({...edit,active:e.target.checked})}/>Receta activa</label>
 {edit.lines.map((l,i)=><div key={i} className="grid gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-[1fr_8rem_auto]"><RecipeMaterialPicker components={components.filter(c=>c.id===l.componentId||!edit.lines.some(x=>x.componentId===c.id))} disabled={busy} value={l.componentId} onChange={id=>setEdit({...edit,lines:edit.lines.map((x,j)=>j===i?{...x,componentId:id}:x)})}/><input required aria-label="Cantidad" disabled={busy} type="number" min={components.find(c=>c.id===l.componentId)?.unit==="pz"?1:0.000001} step={components.find(c=>c.id===l.componentId)?.unit==="pz"?1:"0.000001"} value={l.quantity||""} className={inputClass} onChange={e=>setEdit({...edit,lines:edit.lines.map((x,j)=>j===i?{...x,quantity:Number(e.target.value)}:x)})}/><button type="button" disabled={busy} className="text-red-300" onClick={()=>setEdit({...edit,lines:edit.lines.filter((_,j)=>j!==i)})}>Quitar</button></div>)}
 <button type="button" disabled={busy||edit.lines.length>=50} className={secondaryButtonClass} onClick={()=>setEdit({...edit,lines:[...edit.lines,{componentId:"",quantity:1}]})}>Agregar material</button><p className="text-xs text-white/50">El inicio y la frecuencia se usan para estimar el consumo y avisar de faltantes previstos en los próximos 14 días.</p>{error&&<p role="alert" className="text-red-300">{error}</p>}<button disabled={busy||!edit.lines.length||edit.lines.some(l=>!l.componentId)} className={buttonClass}>Guardar receta</button></form></InventoryDialog>}
 {run&&<InventoryDialog title="Retiro de receta" onClose={()=>{if(!busy){setRun(null);setError("");}}}>
  <form className="space-y-4" onSubmit={async e=>{
   e.preventDefault();
   const meta=Object.fromEntries(new FormData(e.currentTarget)),project=String(meta.project);
   setBusy(true);setError("");
   try{
    const today=mexicoToday(), selected=run.lines.filter(l=>l.included);
    if(!selected.length)throw new Error("Incluye al menos un componente para registrar el retiro.");
    const lines=selected.map(l=>{
     const c=components.find(c=>c.id===l.componentId),quantity=Number(l.quantity);
     if(!c)throw new Error("Material inexistente.");
     if(!Number.isFinite(quantity)||quantity<=0||quantity>1e9||(c.unit==="pz"&&!Number.isInteger(quantity)))throw new Error(c.code+": cantidad inválida.");
     const origin=WAREHOUSES.find(w=>w.usable&&selectLot(c.lots.filter(lot=>lotAvailableForProject(lot,project)),w.id,quantity,today));
     if(!origin)throw new Error(c.code+": no hay un lote vigente con existencias suficientes.");
     return {componentId:c.id,quantity,origin:origin.id,destination:"externo:produccion"};
    });
    const body={...meta,action:"movement",kind:"salida",recipeId:run.id,recipeVersion:run.version,lines,site};
    const signature=JSON.stringify(body);
    if(pendingWithdrawal.current?.signature!==signature)pendingWithdrawal.current={signature,id:crypto.randomUUID()};
    const result=await inventoryRequest<{voucherIds:string[]}>({...body,operationId:pendingWithdrawal.current.id});
    pendingWithdrawal.current=null;
    setRun(null);router.push(voucherDestination(result.voucherIds,site));
   }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }}>
   <div>
    <h2 className="text-xl font-semibold">{run.title}</h2>
    <p className="mt-2 text-sm text-white/60">Selecciona qué componentes retirar y ajusta sus cantidades. Estos cambios solo aplican al movimiento y a sus vales; la receta guardada se conserva.</p>
   </div>
   <fieldset className="space-y-2" disabled={busy}>
    <legend className="mb-2 text-sm font-medium">Componentes del retiro</legend>
    {run.lines.map(l=>{
     const c=components.find(c=>c.id===l.componentId);
     const name=c?`${c.code} · ${c.name}`:l.componentId;
     const updateLine=(fields:Partial<Pick<typeof l,"included"|"quantity">>)=>setRun(current=>current?{...current,lines:current.lines.map(x=>x.componentId===l.componentId?{...x,...fields}:x)}:current);
     return <div key={l.componentId} className={`grid gap-3 rounded-xl border border-white/10 p-3 sm:grid-cols-[1fr_9rem] sm:items-center ${l.included?"bg-white/[0.035]":"opacity-65"}`}>
      <label className="flex min-w-0 items-center gap-3 text-sm">
       <input type="checkbox" className="shrink-0 accent-emerald-400" checked={l.included} onChange={e=>updateLine({included:e.target.checked})}/>
       <span className="break-words">{name}{!l.included&&<span className="block text-xs text-white/60">Excluido de este retiro</span>}</span>
      </label>
      <Field label={`Cantidad${c?.unit?` (${c.unit})`:""}`}>
       <input type="number" aria-label={`Cantidad de ${name}`} required={l.included} disabled={!l.included} min={c?.unit==="pz"?1:0.000001} step={c?.unit==="pz"?1:0.000001} max={1e9} value={l.quantity} onChange={e=>updateLine({quantity:e.target.value})} className={inputClass}/>
      </Field>
     </div>;
    })}
   </fieldset>
   <VoucherProject disabled={busy}/>
   <p className="text-sm text-white/50">Se seleccionan lotes vigentes con cantidad suficiente. Solicitante y receptor se llenan a mano.</p>
   {!run.lines.some(l=>l.included)&&<p className="text-sm text-amber-200">Incluye al menos un componente para continuar.</p>}
   {error&&<p role="alert" className="text-red-300">{error}</p>}
   <button disabled={busy||!run.lines.some(l=>l.included)} className={buttonClass}>{busy?"Registrando retiro…":"Confirmar retiro y abrir vale"}</button>
  </form>
 </InventoryDialog>}
 </InventoryShell>;
}
