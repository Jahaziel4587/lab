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

  /*
   * El PM asigna este título.
   * Mientras no lo haga permanecerá vacío.
   */
  title: string;
  normalizedTitle: string;

  status: AnomalyStatus;
  decision: AnomalyDecision;

  decisionComment?: string;
  decidedByUid?: string;
  decidedByEmail?: string;
  decidedAt?: unknown;

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

  /*
   * Ejemplo:
   * 3 piezas afectadas de una muestra de 20.
   */
  affectedQuantity: number;
  sampleQuantity: number;

  photos: AnomalyOccurrencePhoto[];

  responsiblePmUid: string;
  responsiblePmEmail: string;
  responsiblePmName: string;

  createdByUid: string;
  createdByEmail: string;
  createdByName: string;
  createdAt?: unknown;

  /*
   * Se usarán cuando el PM redirija el reporte
   * a un título de anomalía existente.
   */
  redirectedFromAnomalyId?: string;
  redirectedByUid?: string;
  redirectedByEmail?: string;
  redirectedAt?: unknown;
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