export type NormalizedWorkInstruction = {
  documentCode: string;
  revision: number | null;
  itemName: string;
  displayName: string;
  originalFileName: string;
};

const FILE_EXTENSION_PATTERN = /\.(pdf)$/i;

/*
 * Reconoce formatos como:
 *
 * WI.007.00.312 Rev 4 Top Battery Housing.pdf
 * WI.007.07 REV 1 Retrabajo.pdf
 * WI.007.07 Rev. 2 Retrabajo.pdf
 *
 * La revisión se guarda internamente, pero no aparece
 * dentro de displayName.
 */
export function normalizeWorkInstruction(
  fileName: string,
): NormalizedWorkInstruction | null {
  const originalFileName = fileName.trim();

  if (!FILE_EXTENSION_PATTERN.test(originalFileName)) {
    return null;
  }

  const nameWithoutExtension = originalFileName
    .replace(FILE_EXTENSION_PATTERN, "")
    .trim();

  const documentMatch = nameWithoutExtension.match(
    /^(WI(?:\.[A-Za-z0-9-]+)+)\s+(.+)$/i,
  );

  if (!documentMatch) {
    return null;
  }

  const documentCode = documentMatch[1].toUpperCase();
  const remainingName = documentMatch[2].trim();

  const revisionMatch = remainingName.match(
    /^REV(?:ISION)?\.?\s*[-:]?\s*(\d+)\s*(.*)$/i,
  );

  const revision = revisionMatch
    ? Number(revisionMatch[1])
    : null;

  const itemName = revisionMatch
    ? revisionMatch[2].trim()
    : remainingName;

  if (!itemName) {
    return null;
  }

  return {
    documentCode,
    revision,
    itemName,
    displayName: `${documentCode} ${itemName}`,
    originalFileName,
  };
}