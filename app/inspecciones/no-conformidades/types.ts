export type NonConformitySourceType =
  | "entrada_mts"
  | "entrada_proyecto"
  | "proceso";

export type NonConformityLotStatus =
  | "draft"
  | "finalized";

export type NonConformityContext = {
  sourceType: NonConformitySourceType;
  scopeKey: string;

  projectId?: string;
  projectName?: string;

  wiCode: string;
  wiTitle: string;

  processComponentId?: string;
  processComponentTitle?: string;
};

export type NonConformityPhoto = {
  name: string;
  url: string;
  storagePath: string;
};

export type NonConformityReport = {
  id: string;

  /*
   * Número específico de la muestra
   * que fue rechazada.
   *
   * Ejemplo:
   * muestra 15 de un lote de 200.
   */
  sampleNumber: number;

  description: string;
  photos: NonConformityPhoto[];

  /*
   * Mantiene el orden exacto en el que
   * el inspector registró los reportes.
   */
  sequence: number;

  createdByUid: string;
  createdByEmail: string;
  createdByName: string;
  createdAt?: unknown;

  updatedByUid?: string;
  updatedByEmail?: string;
  updatedByName?: string;
  updatedAt?: unknown;
};

export type NonConformityLot = {
  id: string;

  /*
   * Nombre o identificación capturada
   * por el inspector.
   */
  lotName: string;
  normalizedLotName: string;

  /*
   * Cantidad total de muestras que se
   * planea inspeccionar en este lote.
   */
  sampleQuantity: number;

  /* Cantidad completa de piezas que contiene el lote. */
  lotQuantity: number;
  inspectionType: "normal" | "special";
  inspectionLevel: "I" | "II" | "III" | "S1" | "S2" | "S3" | "S4";
  aql: string;

  status: NonConformityLotStatus;

  /*
   * Mientras el lote está en borrador,
   * esta cantidad se calcula a partir
   * de los reportes existentes.
   *
   * Al finalizar se guarda el resultado
   * definitivo para mantener el historial.
   */
  rejectedSampleCount?: number;

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

  notificationSent?: boolean;
  notificationWarning?: string;

  reportCount?: number;
};

export type ResponsibleNonConformityPm = {
  uid: string;
  email: string;
  name: string;
  pmProjects: string[];
};

export type CreateNonConformityLotInput = {
  lotName: string;
  sampleQuantity: number;
  lotQuantity: number;
  inspectionType: "normal" | "special";
  inspectionLevel: "I" | "II" | "III" | "S1" | "S2" | "S3" | "S4";
  aql: string;
  responsiblePm:
    ResponsibleNonConformityPm;
};

export type AddNonConformityReportInput = {
  sampleNumber: number;
  description: string;
  photos: File[];
};

export type FinalizeNonConformityResult = {
  lotId: string;
  rejectedSampleCount: number;
  sampleQuantity: number;
  notificationSent: boolean;
  notificationWarning: string;
};

export type NonConformityLotWithReports = {
  lot: NonConformityLot;
  reports: NonConformityReport[];
};
