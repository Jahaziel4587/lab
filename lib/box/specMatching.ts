export type BoxSpecReference = {
  documentCode: string;
  revision: number;
  title: string;
  reference: string;
  boxFileId: string;
  originalFileName: string;
};

/** Exact aliases are preferred; reduced project part numbers are used only when unambiguous. */
export function specPartKeys(code: string): string[] {
  const normalized = code.toUpperCase().replace(/\.(PDF)$/i, "").replace(/[\s_]+/g, "");
  const mts = normalized.match(/MTS[.\-]*(\d+)([A-Z]?)(?:[.\-](\d+))?$/);
  if (mts) return [`MTS-${String(Number(mts[1]))}${mts[2]}${mts[3] ? `-${Number(mts[3])}` : ""}`];
  const body = normalized.replace(/^(WI|SPEC)[.\-]*/, "").replace(/\.+$/g, "");
  const full = body.replace(/[^A-Z0-9]/g, "");
  const parts = body.split(/[.\-]+/).filter(Boolean);
  const reduced = parts.filter(part => part !== "00" && /^\d+$/.test(part));
  // Incoming WI codes repeat the project number after their category (INT/MLD/etc.).
  if (reduced.length > 2 && reduced[0] === reduced[1]) reduced.splice(1, 1);
  return Array.from(new Set([full, reduced.length >= 2 ? reduced.join("") : ""].filter(Boolean)));
}

export function parseBoxSpec(file: { id: string; name: string }): BoxSpecReference | null {
  const name = file.name.trim();
  if (!/^SPEC[.\s_-]/i.test(name) || !/\.pdf$/i.test(name)) return null;
  const base = name.replace(/\.pdf$/i, "");
  const match = /[\s_]+REV(?:ISION)?\.?\s*[-:]?\s*(\d+)(?=[\s_]|$)/i.exec(base);
  if (!match) return null;
  const documentCode = base.slice(0, match.index).trim().replace(/[\s_]+/g, ".").replace(/\.+$/g, "");
  const revision = Number(match[1]);
  const title = base.slice(match.index + match[0].length).replace(/^[\s_:-]+/, "").replace(/_/g, " ").trim();
  return { documentCode, revision, title, reference: `${documentCode} Rev${revision}${title ? ` ${title}` : ""}`, boxFileId: file.id, originalFileName: name };
}

export function selectBoxSpec(wiCode: string, files: Array<{ id: string; name: string }>) {
  const parsed = files.map(parseBoxSpec).filter((spec): spec is BoxSpecReference => spec !== null);
  const keys = specPartKeys(wiCode);
  // Compare most-specific code first, then fallback part aliases, never partial substring matches.
  for (const key of keys) {
    const matches = parsed.filter(spec => specPartKeys(spec.documentCode).includes(key));
    if (!matches.length) continue;
    const codes = new Set(matches.map(spec => spec.documentCode.toUpperCase().replace(/[\s_]+/g, "")));
    if (codes.size > 1) return { spec: null, reason: "Hay varias SPEC distintas para este código. Confirma la referencia manualmente." };
    matches.sort((a, b) => b.revision - a.revision || a.boxFileId.localeCompare(b.boxFileId));
    return { spec: matches[0], reason: null };
  }
  return { spec: null, reason: "No se encontró una SPEC PDF con revisión para el código de esta WI." };
}
