import type { IncomingInspectionMethod, IncomingLotReportMode } from "./types";
export type ShiftRejectionState = {
  method: IncomingInspectionMethod;
  shiftIdentifier: string;
  inspectionNumber: number;
  mode: "quantity" | "sample_number";
  rejectedQuantity: number;
  sampleNumbers: number[];
};
export function shiftInspectionKey(method: string, shift: string, number: number) {
  return `${method}_${encodeURIComponent(shift.trim()).replace(/\./g, "%2E")}_${number}`;
}
export function advanceShiftRejections(previous: ShiftRejectionState | undefined, input: {
  method: IncomingInspectionMethod; shiftIdentifier: string; inspectionNumber: number; mode: IncomingLotReportMode;
  quantity: number; sampleNumber?: number; uniqueTotal?: number;
}): ShiftRejectionState {
  if (input.mode !== "quantity" && input.mode !== "sample_number") throw new Error("Modalidad de inspección por turno inválida.");
  if (previous && previous.mode !== input.mode) throw new Error("Conserva la modalidad del primer reporte de esta inspección por turno.");
  const sampleNumbers = [...new Set(previous?.sampleNumbers || [])];
  let rejectedQuantity = previous?.rejectedQuantity || 0;
  if (input.mode === "sample_number") {
    if (!Number.isInteger(input.sampleNumber) || Number(input.sampleNumber) < 1) throw new Error("Número de muestra inválido.");
    if (!sampleNumbers.includes(input.sampleNumber!)) sampleNumbers.push(input.sampleNumber!);
    rejectedQuantity = sampleNumbers.length;
  } else {
    if (!Number.isInteger(input.uniqueTotal) || Number(input.uniqueTotal) < Math.max(rejectedQuantity, input.quantity) || Number(input.uniqueTotal) > rejectedQuantity + input.quantity) throw new Error("Confirma el total acumulado de piezas únicas: no puede disminuir ni exceder las piezas reportadas.");
    rejectedQuantity = Number(input.uniqueTotal);
  }
  return { method: input.method, shiftIdentifier: input.shiftIdentifier.trim(), inspectionNumber: input.inspectionNumber, mode: input.mode, rejectedQuantity, sampleNumbers };
}
