export type InspectionType = "entrada" | "proceso";

export type EntrySource = "mts" | "proyectos";


export type InspectionFindingType =
  | "anormalidad"
  | "no_conformidad";

export type CatalogStatus =
  | "activo"
  | "obsoleto";

export type WorkInstructionCatalogItem = {
  id: string;

  inspectionType: InspectionType;

  entrySource?: EntrySource;

  projectId?: string;
  projectName?: string;

  boxFileId: string;
  boxFolderId: string;

  documentCode: string;
  revision: number | null;
  itemName: string;
  displayName: string;
  originalFileName: string;

  status: CatalogStatus;

  lastSeenAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ManualProcessComponent = {
  id: string;

  workInstructionId: string;
  projectId: string;

  title: string;
  normalizedTitle: string;

  status: CatalogStatus;

  createdByUid: string;
  createdByEmail: string;

  editedByUid?: string;
  editedByEmail?: string;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export function isInspectionType(
  value: string,
): value is InspectionType {
  return value === "entrada" || value === "proceso";
}export type BoxCatalogProject = {
  id: string;
  title: string;
  originalName: string;
};

export type BoxCatalogWorkInstruction = {
  id: string;
  boxFileId: string;
  boxFolderId: string;

  documentCode: string;
  revision: number | null;
  itemName: string;
  title: string;
  originalFileName: string;
};

export type InspectionCatalogScope =
  | "projects"
  | "mts"
  | "incoming"
  | "process";