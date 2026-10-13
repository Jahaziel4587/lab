export type FixedRecipe = { id: string; title: string; startDate: string; intervalDays: number; active: boolean; version: number; lines: Array<{componentId:string;quantity:number}> };
export function recipePeriod(recipe: Pick<FixedRecipe,"startDate"|"intervalDays">, today: string) {
  if (today < recipe.startDate) throw new Error("La receta está fuera de su periodo de vigencia.");
  return Math.floor((Date.parse(today + "T00:00:00Z") - Date.parse(recipe.startDate + "T00:00:00Z")) / 86400000 / recipe.intervalDays);
}
export function validateRecipe(b: unknown): Omit<FixedRecipe,"id"|"version"> {
  const r = b as FixedRecipe;
  if(!r || typeof r.title!=="string" || !r.title.trim() || r.title.length>200 || !Number.isInteger(r.intervalDays) || r.intervalDays<1 || r.intervalDays>3650)throw new Error("Indica título y frecuencia de 1 a 3650 días.");
  for(const value of [r.startDate])if(typeof value!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value).toISOString().slice(0,10)!==value)throw new Error("Fecha inválida.");
  if(!Array.isArray(r.lines) || !r.lines.length || r.lines.length>50)throw new Error("Indica un periodo válido y entre 1 y 50 materiales.");
  if(new Set(r.lines.map(l=>l.componentId)).size!==r.lines.length)throw new Error("Un material aparece más de una vez.");
  const lines=r.lines.map(l=>{if(typeof l.componentId!=="string" || !/^[a-zA-Z0-9]{10,100}$/.test(l.componentId) || !Number.isFinite(l.quantity) || l.quantity<=0 || l.quantity>1e9)throw new Error("Material o cantidad inválidos.");return {componentId:l.componentId,quantity:l.quantity};});
  return {title:r.title.trim(),startDate:r.startDate,intervalDays:r.intervalDays,active:r.active!==false,lines};
}
