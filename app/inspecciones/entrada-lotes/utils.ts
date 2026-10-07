import type {
  IncomingInspectionLot,
  IncomingInspectionContext,
} from "./types";
type BuildContextParams = {
  origin?: string | null;
  isProcess?: boolean;
  componentId?: string | null;
  componentTitle?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  wiCode?: string | null;
  wiTitle?: string | null;
};

function safeKeyPart(value: string) {
  return value
    .trim()
    .replaceAll("/", "_")
    .replace(/\s+/g, "_");
}

export function buildIncomingInspectionContext({
  origin,
  isProcess,
  componentId,
  componentTitle,
  projectId,
  projectName,
  wiCode,
  wiTitle,
}: BuildContextParams):
  IncomingInspectionContext | null {
  if (!wiCode || !wiTitle) {
    return null;
  }

  const sourceType =
    isProcess ? "proceso_proyecto" : origin === "mts"
      ? "entrada_mts"
      : "entrada_proyecto";

  if (
    sourceType !== "entrada_mts" &&
    (!projectId || !projectName)
  ) {
    return null;
  }

  return {
    sourceType,
    scopeKey: [
      sourceType,
      projectId || "shared",
      wiCode,
      ...(isProcess ? [componentId || ""] : []),
    ]
      .map(safeKeyPart)
      .join("__"),
    projectId: projectId || undefined,
    projectName: projectName || undefined,
    wiCode,
    wiTitle,
    componentId: componentId || wiCode,
    componentTitle: componentTitle || wiTitle,
  };
}
export function normalizeIncomingLotName(
  value: string,
) {
  return value
    .trim()
    .toLocaleLowerCase("es-MX")
    .replace(/\s+/g, " ");
}

export function isPositiveInteger(
  value: number,
) {
  return (
    Number.isInteger(value) &&
    value > 0
  );
}

export function isNonNegativeInteger(
  value: number,
) {
  return (
    Number.isInteger(value) &&
    value >= 0
  );
}

export function mapIncomingLot(
  id: string,
  data: Record<string, unknown>,
): IncomingInspectionLot {
  const fallbackPlan = {
    method: "visual" as const,
    isFullInspection: data.isFullInspection === true,
    inspectedQuantity: Number(data.inspectedQuantity || 0),
    inspectionType: data.inspectionType === "special" ? "special" as const : "normal" as const,
    inspectionLevel: String(data.inspectionLevel || "II") as IncomingInspectionLot["inspectionLevel"],
    aql: String(data.aql || ""),
    allowedRejectedQuantity: Number(data.allowedRejectedQuantity || 0),
  };
  const methodPlans = Array.isArray(data.methodPlans) && data.methodPlans.length > 0
    ? data.methodPlans.map((entry) => {
        const item = entry as Record<string, unknown>;
        const method = ["documentary", "visual", "dimensional", "functional"].includes(String(item.method)) ? String(item.method) as IncomingInspectionLot["methodPlans"][number]["method"] : "visual";
        return { method, isFullInspection: item.isFullInspection === true, inspectedQuantity: Number(item.inspectedQuantity || 0), inspectionType: item.inspectionType === "special" ? "special" as const : "normal" as const, inspectionLevel: String(item.inspectionLevel || "II") as IncomingInspectionLot["inspectionLevel"], aql: String(item.aql || ""), allowedRejectedQuantity: Number(item.allowedRejectedQuantity || 0) };
      }) : [fallbackPlan];
  return {
    id,
    lotName: String(data.lotName || ""),
    normalizedLotName: String(
      data.normalizedLotName || "",
    ),
    purchaseOrder: String(data.purchaseOrder || ""),
    totalLotQuantity: Number(
      data.totalLotQuantity || 0,
    ),
    inspectedQuantity: Number(
      data.inspectedQuantity || 0,
    ),
    inspectionType:
      data.inspectionType === "special"
        ? "special"
        : "normal",
    inspectionLevel: String(
      data.inspectionLevel || "II",
    ) as IncomingInspectionLot[
      "inspectionLevel"
    ],
    aql: String(data.aql || ""),
    allowedRejectedQuantity: Number(
      data.allowedRejectedQuantity || 0,
    ),
    methodPlans,
    status:
      data.status === "finalized"
        ? "finalized"
        : "in_progress",
    inspectionResult:
      data.inspectionResult === "will_fail"
        ? "will_fail"
        : data.inspectionResult ===
              "within_limit"
          ? "within_limit"
          : "pending",
    specCountingMode:
      data.specCountingMode ===
      "sample_number"
        ? "sample_number"
        : data.specCountingMode ===
              "quantity"
          ? "quantity"
          : null,
    reportedRejectedQuantity: Number(
      data.reportedRejectedQuantity || 0,
    ),
    confirmedUniqueRejectedQuantity:
      typeof data
        .confirmedUniqueRejectedQuantity ===
      "number"
        ? data.confirmedUniqueRejectedQuantity
        : undefined,
    lastReviewedReportedQuantity:
      typeof data
        .lastReviewedReportedQuantity ===
      "number"
        ? data.lastReviewedReportedQuantity
        : undefined,
    finalRejectedPieces:
      typeof data.finalRejectedPieces ===
      "number"
        ? data.finalRejectedPieces
        : undefined,
    failureNotificationSent:
      data.failureNotificationSent === true,
    failureNotificationSentAt:
      data.failureNotificationSentAt,
    failureConfirmedByUid: String(
      data.failureConfirmedByUid || "",
    ) || undefined,
    failureConfirmedByEmail: String(
      data.failureConfirmedByEmail || "",
    ) || undefined,
    failureConfirmedByName: String(
      data.failureConfirmedByName || "",
    ) || undefined,
    responsiblePmUid: String(
      data.responsiblePmUid || "",
    ),
    responsiblePmEmail: String(
      data.responsiblePmEmail || "",
    ),
    responsiblePmName: String(
      data.responsiblePmName || "",
    ),
    createdByUid: String(
      data.createdByUid || "",
    ),
    createdByEmail: String(
      data.createdByEmail || "",
    ),
    createdByName: String(
      data.createdByName || "",
    ),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    finalizedByUid: String(
      data.finalizedByUid || "",
    ) || undefined,
    finalizedByEmail: String(
      data.finalizedByEmail || "",
    ) || undefined,
    finalizedByName: String(
      data.finalizedByName || "",
    ) || undefined,
    finalizedAt: data.finalizedAt,
    finalAnomalyQuantities: Array.isArray(data.finalAnomalyQuantities)
      ? data.finalAnomalyQuantities.map((entry) => {
          const item = entry as Record<string, unknown>;
          return {
            inspectionMethod: ["documentary", "visual", "dimensional", "functional"].includes(String(item.inspectionMethod)) ? item.inspectionMethod as IncomingInspectionLot["methodPlans"][number]["method"] : undefined,
            title: String(item.title || ""),
            quantity: Number(item.quantity || 0),
          };
        })
      : undefined,
    methodReviewState: data.methodReviewState && typeof data.methodReviewState === "object" ? data.methodReviewState as IncomingInspectionLot["methodReviewState"] : undefined,
    nonconformanceDetails: data.nonconformanceDetails && typeof data.nonconformanceDetails === "object" ? data.nonconformanceDetails as IncomingInspectionLot["nonconformanceDetails"] : undefined,
    rejectionClarifications: Array.isArray(data.rejectionClarifications)
      ? data.rejectionClarifications.map((entry) => {
          const item = entry as Record<string, unknown>;
          return {
            reportedQuantity: Number(item.reportedQuantity || 0),
            confirmedUniqueQuantity: Number(item.confirmedUniqueQuantity || 0),
            allowedQuantity: Number(item.allowedQuantity || 0),
            repeatedSamples: item.repeatedSamples === true,
            createdByName: String(item.createdByName || "Usuario"),
            createdAt: item.createdAt,
          };
        })
      : undefined,
  };
}
