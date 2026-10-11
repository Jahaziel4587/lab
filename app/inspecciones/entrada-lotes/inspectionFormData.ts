import type { IncomingInspectionFormData, IncomingInspectionMethodPlan } from "./types";
export function validateInspectionFormData(data: IncomingInspectionFormData, plans: IncomingInspectionMethodPlan[], results = false) {
  if (!Number.isInteger(Number(data.purchasedQuantity)) || !data.purchasedQuantity?.trim() || Number(data.purchasedQuantity) < 1) throw new Error("Agrega la cantidad comprada.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.receivedDate || "")) throw new Error("Agrega la fecha de recepción.");
  if (!data.supplierName?.trim()) throw new Error("Agrega el proveedor o manufacturero.");
  if (!data.noExpiration && !/^\d{4}-\d{2}-\d{2}$/.test(data.expirationDate || "")) throw new Error("Agrega la fecha de expiración o selecciona No aplica.");
  if (data.documentation?.includes("other") && !data.otherDocumentation?.trim()) throw new Error("Especifica la otra documentación.");
  if (!data.specReference?.trim() || !data.wiRevision?.trim()) throw new Error("Agrega la referencia de SPEC y la revisión de la WI; puedes escribir No aplica en SPEC.");
  if (!results) return;
  for (const plan of plans) {
    const value = data.failedQuantities?.[plan.method];
    if (!value?.trim() || !Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > plan.inspectedQuantity) throw new Error("Confirma las muestras únicas que no pasaron en cada método (entre 0 y la cantidad inspeccionada).");
  }
  if (!data.totalDefects?.trim() || !Number.isInteger(Number(data.totalDefects)) || Number(data.totalDefects) < 0) throw new Error("Confirma el número total de defectos.");
  if (!["accepted", "rejected", "other"].includes(data.lotDisposition || "")) throw new Error("Selecciona el resultado final del lote.");
  if (data.lotDisposition === "other" && !data.lotComments?.trim()) throw new Error("Describe el otro resultado del lote en comentarios.");
}
