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

export function buildSuggestedRejectionSummary(reports: IncomingLotReport[]) {
  const titles = Array.from(new Set(
    reports
      .filter((report) => report.kind === "spec_rejection" || (report.kind === "anomaly" && report.decision === "fail"))
      .map((report) => report.title.trim())
      .filter(Boolean),
  ));
  return titles.length ? titles.join(", ") : "Piezas rechazadas durante la inspección de entrada.";
}

export function buildNonconformanceDescription(
  lot: IncomingInspectionLot,
  reports: IncomingLotReport[],
) {
  const failedMethods = lot.methodPlans.filter(
    (plan) => lot.methodReviewState?.[plan.method]?.result === "will_fail",
  );
  const methodDetails = failedMethods.map((plan) => {
    const review = lot.methodReviewState?.[plan.method];
    return `${incomingMethodLabel(plan.method)}: ${review?.confirmedUniqueQuantity ?? 0} piezas rechazadas únicas frente a ${plan.allowedRejectedQuantity} permitidas (muestra de ${plan.inspectedQuantity}, AQL ${plan.aql}, inspección ${plan.inspectionType === "special" ? "especial" : "normal"}, nivel ${plan.inspectionLevel}).`;
  }).join(" ");
  const findings = buildSuggestedRejectionSummary(reports);
  return `Durante la inspección de entrada del lote ${lot.lotName} se excedió el criterio de aceptación en ${failedMethods.length || 1} método(s) de inspección. ${methodDetails} Hallazgos registrados: ${findings}. El lote se determinó no conforme y quedó sujeto a la disposición indicada.`;
}
