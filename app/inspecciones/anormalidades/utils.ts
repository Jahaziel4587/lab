import type {
  AnomalyContext,
  AnomalySourceType,
} from "./types";

type BuildAnomalyContextParams = {
  isEntrada: boolean;
  origin?: string | null;

  projectId?: string | null;
  projectName?: string | null;

  wiCode?: string | null;
  wiTitle?: string | null;

  processComponentId?: string | null;
  processComponentTitle?: string | null;
};

function safeKeyPart(value: string) {
  return value
    .trim()
    .replaceAll("/", "_")
    .replace(/\s+/g, "_");
}

export function normalizeAnomalyTitle(
  value: string,
) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-MX");
}

export function buildAnomalyContext({
  isEntrada,
  origin,
  projectId,
  projectName,
  wiCode,
  wiTitle,
  processComponentId,
  processComponentTitle,
}: BuildAnomalyContextParams):
  AnomalyContext | null {
  if (!wiCode || !wiTitle) {
    return null;
  }

  let sourceType:
    AnomalySourceType;

  if (
    isEntrada &&
    origin === "mts"
  ) {
    sourceType = "entrada_mts";
  } else if (isEntrada) {
    sourceType = "entrada_proyecto";
  } else {
    sourceType = "proceso";
  }

  if (
    sourceType === "entrada_proyecto" &&
    (!projectId || !projectName)
  ) {
    return null;
  }

  if (
    sourceType === "proceso" &&
    (
      !projectId ||
      !projectName ||
      !processComponentId ||
      !processComponentTitle
    )
  ) {
    return null;
  }

  const scopeParts = [
    sourceType,
    projectId || "shared",
    wiCode,
  ];

  if (
    sourceType === "proceso" &&
    processComponentId
  ) {
    scopeParts.push(
      processComponentId,
    );
  }

  return {
    sourceType,
    scopeKey: scopeParts
      .map(safeKeyPart)
      .join("__"),

    projectId:
      projectId || undefined,
    projectName:
      projectName || undefined,

    wiCode,
    wiTitle,

    processComponentId:
      processComponentId || undefined,
    processComponentTitle:
      processComponentTitle || undefined,
  };
}