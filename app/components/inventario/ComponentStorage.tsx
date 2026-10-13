"use client";
import { useEffect, useState } from "react";
import type { InventoryComponent } from "@/lib/inventario/types";
import { inventoryRequest } from "@/lib/inventario/service";
import { opsRequest } from "@/lib/operacional/client";
import { useInventorySite } from "./InventoryProvider";
import StorageFields from "./StorageFields";
import { panelClass, buttonClass, inputClass } from "./InventoryShell";
type Review = {id:string;message:string;status:string;notes?:string;lots:Array<{name:string}>};
export default function ComponentStorage({component,onSaved}:{component:InventoryComponent;onSaved:()=>void}) {
  const {site}=useInventorySite();const [reviews,setReviews]=useState<Review[]>([]),[canReview,setCanReview]=useState(false),[error,setError]=useState(""),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{let live=true;opsRequest(`/api/inventario/storage-reviews?site=${site}&componentId=${component.id}`).then(d=>{if(live){setReviews(d.reviews);setCanReview(d.canReview);}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[site,component.id,revision]);
  return <section className={`${panelClass} space-y-5`}><h2 className="text-lg font-semibold">Almacenamiento del componente</h2>
    <form key={`${component.id}:${component.temperatureCondition}:${component.humidityCondition}`} className="space-y-4" onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{await inventoryRequest({action:"storage",componentId:component.id,...Object.fromEntries(new FormData(e.currentTarget)),site});onSaved();setRevision(r=>r+1);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><StorageFields component={component}/><button disabled={busy} className={buttonClass}>Guardar condiciones</button></form>
    {error&&<p role="alert" className="text-red-300">{error}</p>}
    <h3 className="font-semibold">Revisiones de lotes existentes</h3>{!reviews.length&&<p className="text-sm text-white/50">Sin revisiones registradas.</p>}
    {reviews.map(r=><div key={r.id} className="space-y-3 rounded-2xl border border-white/10 p-4"><p>{r.message}</p><p className="text-sm text-white/60">Lotes: {r.lots.map(l=>l.name).join(", ")}</p><p className="text-sm text-emerald-300">{r.status==="reviewed"?`Revisado · ${r.notes}`:"Pendiente de revisión del almacenista"}</p>{r.status!=="reviewed"&&canReview&&<form className="space-y-2" onSubmit={async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));setBusy(true);try{await opsRequest("/api/inventario/storage-reviews",{id:r.id,site,notes:data.notes});setRevision(n=>n+1);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><textarea name="notes" required maxLength={1000} className={inputClass} placeholder="Resultado de la revisión y movimientos necesarios"/><button className={buttonClass} disabled={busy}>Confirmar revisión</button></form>}</div>)}
  </section>;
}
