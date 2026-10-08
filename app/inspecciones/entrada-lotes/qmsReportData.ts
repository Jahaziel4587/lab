import type {
  IncomingInspectionContext,
  IncomingInspectionLot,
  IncomingInspectionMethod,
  IncomingLotReport,
} from "./types";

export function extractIncomingPartInfo(context: IncomingInspectionContext) {
  const fullCode = String(context.wiCode || context.componentId || "").trim();
  const title = String(context.componentTitle || context.wiTitle || "").trim();
  const match = fullCode.match(/(?:WI(?:\.00)?[.-])?([A-Z]+-?\d+(?:-\d+)?)/i);
  const partNumber = match?.[1] || fullCode.replace(/^WI\.00[.-]?/i, "") || "NA";
  const partName = title.replace(fullCode, "").replace(/^[-–—:\s]+/, "").trim() || title || "NA";
  return { partNumber, partName };
}

export function incomingMethodLabel(method?: IncomingInspectionMethod) {
  if (method === "documentary") return "Documental";
  if (method === "dimensional") return "Dimensional";
  if (method === "functional") return "Funcional";
  return "Visual";
}

export function buildSuggestedRejectionSummary(reports: IncomingLotReport[], isProcess = false) {
  const safeReports = Array.isArray(reports) ? reports : [];
  const titles = Array.from(new Set(
    [...safeReports].sort((a,b)=>["spec_rejection","line_rejection","component_rejection","anomaly"].indexOf(a.kind)-["spec_rejection","line_rejection","component_rejection","anomaly"].indexOf(b.kind))
      .filter((report) => report.kind === "spec_rejection" || report.kind === "line_rejection" || report.kind === "component_rejection" || (report.kind === "anomaly" && report.decision === "fail"))
      .map((report) => `${report.kind === "anomaly" ? "Anormalidad" : report.kind === "line_rejection" ? "Rechazo en línea" : report.kind === "component_rejection" ? "Rechazo por componente" : "Rechazo por SPEC"}: ${report.title.trim()}${report.mode === "quantity" ? ` (${report.quantity || 0} piezas)` : ` (muestra #${report.sampleNumber})`}${report.shiftIdentifier ? ` · Por turno: ${report.shiftIdentifier}, inspección #${report.shiftInspectionNumber}` : ""}`)
      .filter(Boolean),
  ));
  return titles.length ? titles.join(", ") : `Piezas rechazadas durante la inspección de ${isProcess ? "proceso" : "entrada"}.`;
}

export function buildNonconformanceDescription(
  lot: IncomingInspectionLot,
  reports: IncomingLotReport[],
  isProcess = false,
) {
  const methodPlans = Array.isArray(lot.methodPlans) ? lot.methodPlans : [];
  const failedMethods = methodPlans.filter(
    (plan) => lot.methodReviewState?.[plan.method]?.result === "will_fail",
  );
  const methodDetails = failedMethods.map((plan) => {
    if (plan.perShift) return `${incomingMethodLabel(plan.method)}: se registró un rechazo por SPEC durante una de las ${plan.inspectionsPerShift} inspecciones programadas por turno.`;
    const review = lot.methodReviewState?.[plan.method];
    return `${incomingMethodLabel(plan.method)}: ${review?.confirmedUniqueQuantity ?? 0} piezas rechazadas únicas frente a ${plan.allowedRejectedQuantity} permitidas (muestra de ${plan.inspectedQuantity}, AQL ${plan.aql}, inspección ${plan.inspectionType === "special" ? "especial" : "normal"}, nivel ${plan.inspectionLevel}).`;
  }).join(" ");
  const findings = buildSuggestedRejectionSummary(reports.filter(report => report.kind === "spec_rejection"));
  return `Durante la inspección de ${isProcess ? "proceso" : "entrada"} del lote ${lot.lotName} se excedió el criterio de aceptación en ${failedMethods.length || 1} método(s) de inspección. ${methodDetails} Hallazgos registrados: ${findings}. El lote se determinó no conforme y quedó sujeto a la disposición indicada.`;
}
