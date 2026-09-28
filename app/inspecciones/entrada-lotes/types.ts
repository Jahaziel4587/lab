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