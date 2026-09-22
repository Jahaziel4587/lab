export type AnomalySourceType =
  | "entrada_mts"
  | "entrada_proyecto"
  | "proceso";

export type AnomalyStatus =
  | "pending_title"
  | "pending_decision"
  | "resolved";

export type AnomalyDecision =
  | "pass"
  | "fail"
  | null;

export type InspectionAnomaly = {
  id: string;
  title: string;
  normalizedTitle: string;
  status: AnomalyStatus;
  decision: AnomalyDecision;
  decisionComment?: string;
  decidedByUid?: string;
  decidedByEmail?: string;
  decidedByName?: string;
  decidedAt?: unknown;
  responsiblePmUid?: string;
  responsiblePmEmail?: string;
  responsiblePmName?: string;
  createdByUid: string;
  createdByEmail: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type AnomalyOccurrencePhoto = {
  name: string;
  url: string;
  storagePath: string;
};

export type AnomalyOccurrence = {
  id: string;
  anomalyId: string;
  description: string;
  lot: string;
  affectedQuantity: number;
  sampleQuantity: number;
  reportType?: "occurrence" | "lot_summary";
  inspectedQuantity?: number;
  lotQuantity?: number;
  photos: AnomalyOccurrencePhoto[];
  responsiblePmUid: string;
  responsiblePmEmail: string;
  responsiblePmName: string;
  createdByUid: string;
  createdByEmail: string;
  createdByName: string;
  createdAt?: unknown;
  followUp?: boolean;
  relatedFromAnomalyId?: string;
  relatedFromOccurrenceId?: string;
  redirectedToAnomalyId?: string;
  redirectedToOccurrenceId?: string;
  redirectedFromAnomalyId?: string;
  redirectedByUid?: string;
  redirectedByEmail?: string;
  redirectedAt?: unknown;
};

export type AnomalyMessage = {
  id: string;
  text: string;
  type?:
    | "message"
    | "decision"
    | "routing";
  targetAnomalyId?: string;
  sourceAnomalyId?: string;
  createdByUid: string;
  createdByEmail: string;
  createdByName: string;
  createdAt?: unknown;
};

export type AnomalyContext = {
  sourceType: AnomalySourceType;
  scopeKey: string;
  projectId?: string;
  projectName?: string;
  wiCode: string;
  wiTitle: string;
  processComponentId?: string;
  processComponentTitle?: string;
};
