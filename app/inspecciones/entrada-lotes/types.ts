export type IncomingInspectionSource =
  | "entrada_mts"
  | "entrada_proyecto";

export type IncomingInspectionType =
  | "normal"
  | "special";

export type IncomingInspectionLevel =
  | "I"
  | "II"
  | "III"
  | "S1"
  | "S2"
  | "S3"
  | "S4";

export type IncomingLotStatus =
  | "in_progress"
  | "finalized";

export type IncomingLotResult =
  | "pending"
  | "within_limit"
  | "will_fail";

export type SpecCountingMode =
  | "sample_number"
  | "quantity"
  | null;

export type IncomingInspectionContext = {
  sourceType: IncomingInspectionSource;
  scopeKey: string;
  projectId?: string;
  projectName?: string;
  wiCode: string;
  wiTitle: string;
  componentId: string;
  componentTitle: string;
};

export type IncomingLotResponsible = {
  uid: string;
  email: string;
  name: string;
};

export type IncomingInspectionLot = {
  id: string;
  lotName: string;
  normalizedLotName: string;
  totalLotQuantity: number;
  inspectedQuantity: number;
  inspectionType: IncomingInspectionType;
  inspectionLevel: IncomingInspectionLevel;
  aql: string;
  allowedRejectedQuantity: number;
  status: IncomingLotStatus;
  inspectionResult: IncomingLotResult;
  specCountingMode: SpecCountingMode;

  /* Suma de cantidades de todos los reportes por SPEC. */
  reportedRejectedQuantity: number;

  /* Cantidad de piezas diferentes confirmada por el inspector. */
  confirmedUniqueRejectedQuantity?: number;

  /* Total reportado que ya fue revisado por el inspector. */
  lastReviewedReportedQuantity?: number;

  /* Piezas del lote que no estarán disponibles para producción, sin duplicarlas. */
  finalRejectedPieces?: number;

  failureNotificationSent: boolean;
  failureNotificationSentAt?: unknown;
  failureConfirmedByUid?: string;
  failureConfirmedByEmail?: string;
  failureConfirmedByName?: string;

  responsiblePmUid: string;
  responsiblePmEmail: string;
  responsiblePmName: string;

  createdByUid: string;
  createdByEmail: string;
  createdByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;

  finalizedByUid?: string;
  finalizedByEmail?: string;
  finalizedByName?: string;
  finalizedAt?: unknown;
  finalAnomalyQuantities?: Array<{
    title: string;
    quantity: number;
  }>;
  rejectionClarifications?: IncomingLotRejectionClarification[];
};

export type IncomingLotRejectionClarification = {
  reportedQuantity: number;
  confirmedUniqueQuantity: number;
  allowedQuantity: number;
  repeatedSamples: boolean;
  createdByName: string;
  createdAt?: unknown;
};

export type CreateIncomingInspectionLotInput = {
  lotName: string;
  totalLotQuantity: number;
  inspectedQuantity: number;
  inspectionType: IncomingInspectionType;
  inspectionLevel: IncomingInspectionLevel;
  aql: string;
  allowedRejectedQuantity: number;
  responsiblePm: IncomingLotResponsible;
};

export type IncomingLotFindingKind =
  | "anomaly"
  | "spec_rejection";

export type IncomingLotReportMode =
  | "quantity"
  | "sample_number";

export type IncomingLotReportPhoto = {
  name: string;
  url: string;
  storagePath: string;
};

export type IncomingLotReport = {
  id: string;
  kind: IncomingLotFindingKind;
  mode: IncomingLotReportMode;
  title: string;
  description: string;
  quantity?: number;
  sampleNumber?: number;
  finalRejectedQuantity?: number;
  photos: IncomingLotReportPhoto[];
  status?: "pending_title" | "pending_decision" | "resolved";
  decision?: "pass" | "fail" | null;
  decidedByUid?: string;
  decidedByEmail?: string;
  decidedByName?: string;
  decidedAt?: unknown;
  createdByUid: string;
  createdByEmail: string;
  createdByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type IncomingLotAnomalyMessage = {
  id: string;
  text: string;
  type: "message" | "decision";
  createdByUid: string;
  createdByEmail: string;
  createdByName: string;
  createdAt?: unknown;
};

export type CreateIncomingLotReportInput = {
  kind: IncomingLotFindingKind;
  mode: IncomingLotReportMode;
  title: string;
  description: string;
  quantity?: number;
  sampleNumber?: number;
  photos: File[];
};
