import "server-only";

import { listBoxFolderItems } from "./boxClient";
import { normalizeWorkInstruction } from
  "@/app/inspecciones/utils/normalizeWorkInstruction";

export type BoxCatalogProject = {
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

type InspectionFolderType =
  | "incoming"
  | "process";

function getRequiredEnvironmentVariable(
  name: string,
) {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Falta ${name} en las variables de entorno`,
    );
  }

  return value;
}

function normalizeFolderName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(
      /^\s*\d+(?:\.\d+)*[.\s_-]*/,
      "",
    )
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isInspectionFolder(
  folderName: string,
  type: InspectionFolderType,
) {
  const normalized =
    normalizeFolderName(folderName);

  if (type === "incoming") {
    return normalized.startsWith(
      "incoming inspection wi",
    );
  }

  return normalized.startsWith(
    "in process wi",
  );
}

function isPdfFile({
  name,
  extension,
}: {
  name: string;
  extension?: string;
}) {
  return (
    extension?.toLowerCase() === "pdf" ||
    name.toLowerCase().endsWith(".pdf")
  );
}

export async function getDmrProjects() {
  const dmrFolderId =
    getRequiredEnvironmentVariable(
      "BOX_DMR_FOLDER_ID",
    );

  const response =
    await listBoxFolderItems(dmrFolderId);

  return response.entries
    .filter(
      (item) =>
        item.type === "folder" &&
        /^DMR\.\d+/i.test(item.name.trim()),
    )
    .map<BoxCatalogProject>((folder) => ({
      id: folder.id,
      title: folder.name.trim(),
      originalName: folder.name,
    }))
    .sort((a, b) =>
      a.title.localeCompare(b.title, "es", {
        numeric: true,
        sensitivity: "base",
      }),
    );
}

export async function getMtsWorkInstructions() {
  const mtsFolderId =
    getRequiredEnvironmentVariable(
      "BOX_MTS_FOLDER_ID",
    );

  return getWorkInstructionsFromFolder(
    mtsFolderId,
  );
}

export async function getProjectWorkInstructions({
  projectId,
  type,
}: {
  projectId: string;
  type: InspectionFolderType;
}) {
  if (!/^\d+$/.test(projectId)) {
    throw new Error(
      "El identificador del proyecto no es válido",
    );
  }

  const projectContents =
    await listBoxFolderItems(projectId);

  const inspectionFolder =
    projectContents.entries.find(
      (item) =>
        item.type === "folder" &&
        isInspectionFolder(item.name, type),
    );

  if (!inspectionFolder) {
    return {
      folderFound: false,
      folderId: null,
      folderName: null,
      workInstructions: [],
    };
  }

  const workInstructions =
    await getWorkInstructionsFromFolder(
      inspectionFolder.id,
    );

  return {
    folderFound: true,
    folderId: inspectionFolder.id,
    folderName: inspectionFolder.name,
    workInstructions,
  };
}

async function getWorkInstructionsFromFolder(
  folderId: string,
) {
  const response =
    await listBoxFolderItems(folderId);

  const normalizedItems =
    response.entries
      .filter(
        (item) =>
          item.type === "file" &&
          isPdfFile(item),
      )
      .map((file) => {
        const normalized =
          normalizeWorkInstruction(file.name);

        if (!normalized) {
          return null;
        }

        return {
          /*
           * El código de la WI es la identidad estable.
           * No cambia cuando cambia la revisión.
           */
          id: normalized.documentCode,

          /*
           * Este sí representa el PDF vigente en Box.
           */
          boxFileId: file.id,
          boxFolderId: folderId,

          documentCode:
            normalized.documentCode,

          revision:
            normalized.revision,

          itemName:
            normalized.itemName,

          title:
            normalized.displayName,

          originalFileName:
            normalized.originalFileName,
        } satisfies BoxCatalogWorkInstruction;
      })
      .filter(
        (
          item,
        ): item is BoxCatalogWorkInstruction =>
          item !== null,
      );

  /*
   * Si por algún motivo permanecen dos PDF con el mismo
   * código pero diferentes revisiones, conserva únicamente
   * la revisión más alta.
   */
  const latestByDocumentCode =
    new Map<
      string,
      BoxCatalogWorkInstruction
    >();

  for (const item of normalizedItems) {
    const key =
      item.documentCode.toLowerCase();

    const current =
      latestByDocumentCode.get(key);

    if (!current) {
      latestByDocumentCode.set(key, item);
      continue;
    }

    const currentRevision =
      current.revision ?? -1;

    const newRevision =
      item.revision ?? -1;

    if (newRevision > currentRevision) {
      latestByDocumentCode.set(key, item);
    }
  }

  return Array.from(
    latestByDocumentCode.values(),
  ).sort((a, b) =>
    a.title.localeCompare(b.title, "es", {
      numeric: true,
      sensitivity: "base",
    }),
  );
}