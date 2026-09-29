import type {
  IncomingInspectionLot,
  IncomingInspectionContext,
} from "./types";
type BuildContextParams = {
  origin?: string | null;
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
    origin === "mts"
      ? "entrada_mts"
      : "entrada_proyecto";

  if (
    sourceType === "entrada_proyecto" &&
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
    ]
      .map(safeKeyPart)
      .join("__"),
    projectId: projectId || undefined,
    projectName: projectName || undefined,
    wiCode,
    wiTitle,
    componentId: wiCode,
    componentTitle: wiTitle,
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
  return {
    id,
    lotName: String(data.lotName || ""),
    normalizedLotName: String(
      data.normalizedLotName || "",
    ),
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
            title: String(item.title || ""),
            quantity: Number(item.quantity || 0),
          };
        })
      : undefined,
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
