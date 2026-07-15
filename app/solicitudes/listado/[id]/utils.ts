export function prettyKey(k: string) {
  if (!k) return k;
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function formatNumber(n: number) {
  if (Number.isInteger(n)) return n.toString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function formatMoney(n: number) {
  return `MXN ${n.toFixed(2)}`;
}

export function sanitizeForFirestore<T = any>(val: T): T {
  if (val === undefined) return null as any;
  if (val === null) return val;
  if (typeof val === "function") return undefined as any;

  if (Array.isArray(val)) {
    return val
      .map((x) => sanitizeForFirestore(x))
      .filter((x) => x !== undefined) as any;
  }

  if (typeof val === "object") {
    const out: any = {};
    Object.entries(val as any).forEach(([k, v]) => {
      const clean = sanitizeForFirestore(v);
      if (clean !== undefined) out[k] = clean;
    });
    return out;
  }

  return val;
}

export function wrapLines(
  text: string,
  font: any,
  fontSize: number,
  maxWidth: number
): string[] {
  if (!text) return [];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const width = font.widthOfTextAtSize(test, fontSize);

    if (width <= maxWidth) line = test;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }

  if (line) lines.push(line);
  return lines;
}

export async function loadPdfMake() {
  const pdfMake = (await import("pdfmake/build/pdfmake")).default;
  const vfsFonts = await import("pdfmake/build/vfs_fonts");

  // @ts-ignore
  pdfMake.vfs = vfsFonts.vfs;

  return pdfMake;
}

export function getBaseTitle(titulo: string) {
  return String(titulo || "Sin título")
    .replace(/\s\(\d+\)$/g, "")
    .trim();
}

export function getExecutionTitle(tituloBase: string, numero: number) {
  const base = getBaseTitle(tituloBase);

  if (numero <= 1) return base;

  return `${base} (${numero})`;
}