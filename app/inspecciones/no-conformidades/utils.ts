import type {
  NonConformityContext,
  NonConformityReport,
  NonConformitySourceType,
} from "./types";

type BuildNonConformityContextParams = {
  isEntrada: boolean;
  origin?: string | null;

  projectId?: string | null;
  projectName?: string | null;

  wiCode?: string | null;
  wiTitle?: string | null;

  processComponentId?: string | null;
  processComponentTitle?: string | null;
};

function safeKeyPart(
  value: string,
) {
  return value
    .trim()
    .replaceAll("/", "_")
    .replace(/\s+/g, "_");
}

export function normalizeLotName(
  value: string,
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-MX");
}

export function normalizeProjectName(
  value: string,
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .trim()
    /*
     * Elimina DMR al inicio.
     *
     * Ejemplos:
     * DMR.001 Ocumetics
     * DMR 001. Ocumetics
     */
    .replace(
      /^DMR[\s._-]*/i,
      "",
    )
    /*
     * Elimina el código numérico inicial.
     *
     * Ejemplos:
     * 001. Ocumetics
     * 001.Ocumetics
     * 001 Ocumetics
     */
    .replace(
      /^\d+(?:\.\d+)*[.\s_-]*/,
      "",
    )
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es-MX");
}

export function sanitizeFileName(
  value: string,
) {
  return value
    .trim()
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    );
}

export function isValidSampleQuantity(
  value: number,
) {
  return (
    Number.isInteger(value) &&
    value > 0
  );
}

export function isValidSampleNumber(
  sampleNumber: number,
  sampleQuantity: number,
) {
  return (
    Number.isInteger(sampleNumber) &&
    Number.isInteger(sampleQuantity) &&
    sampleQuantity > 0 &&
    sampleNumber >= 1 &&
    sampleNumber <= sampleQuantity
  );
}

export function getRejectedSampleCount(
  reports: NonConformityReport[],
) {
  /*
   * Se cuentan números de muestra únicos.
   *
   * Esto evita que una misma muestra sea
   * contabilizada dos veces si en el futuro
   * llega a tener más de un registro.
   */
  const rejectedSamples =
    new Set<number>();

  reports.forEach((report) => {
    if (
      Number.isInteger(
        report.sampleNumber,
      ) &&
      report.sampleNumber > 0
    ) {
      rejectedSamples.add(
        report.sampleNumber,
      );
    }
  });

  return rejectedSamples.size;
}

export function sortReportsBySequence(
  reports: NonConformityReport[],
) {
  return [...reports].sort(
    (first, second) => {
      const firstSequence =
        Number(first.sequence || 0);

      const secondSequence =
        Number(second.sequence || 0);

      if (
        firstSequence !==
        secondSequence
      ) {
        return (
          firstSequence -
          secondSequence
        );
      }

      return (
        first.sampleNumber -
        second.sampleNumber
      );
    },
  );
}

export function buildSampleLabel(
  sampleNumber: number,
  sampleQuantity: number,
) {
  return (
    `Muestra ${sampleNumber} ` +
    `de ${sampleQuantity}`
  );
}

export function buildRejectedSummary(
  inspectorName: string,
  lotName: string,
  rejectedSampleCount: number,
) {
  const inspector =
    inspectorName.trim() ||
    "Un inspector";

  const lot =
    lotName.trim() ||
    "Sin nombre";

  const rejectedLabel =
    rejectedSampleCount === 1
      ? "1 pieza fue rechazada"
      : `${rejectedSampleCount} piezas ` +
        "fueron rechazadas";

  return (
    `${inspector} registró que para ` +
    `el lote "${lot}", ` +
    `${rejectedLabel}.`
  );
}

export function buildNonConformityContext({
  isEntrada,
  origin,
  projectId,
  projectName,
  wiCode,
  wiTitle,
  processComponentId,
  processComponentTitle,
}: BuildNonConformityContextParams):
  NonConformityContext | null {
  if (
    !wiCode ||
    !wiTitle
  ) {
    return null;
  }

  let sourceType:
    NonConformitySourceType;

  if (
    isEntrada &&
    origin === "mts"
  ) {
    sourceType = "entrada_mts";
  } else if (isEntrada) {
    sourceType =
      "entrada_proyecto";
  } else {
    sourceType = "proceso";
  }

  if (
    sourceType ===
      "entrada_proyecto" &&
    (
      !projectId ||
      !projectName
    )
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
      processComponentId ||
      undefined,

    processComponentTitle:
      processComponentTitle ||
      undefined,
  };
}