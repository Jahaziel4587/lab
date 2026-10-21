import { NextRequest, NextResponse } from "next/server";
import { identify } from "@/lib/operacional/server";
import PizZip from "pizzip";
import { importPdoXml } from "@/lib/production/pdo-import";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  if (!await identify(req)) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  try {
    if (Number(req.headers.get("content-length")) > 3 * 1024 * 1024) throw new Error("El DOCX debe pesar menos de 3 MB.");
    const form = await req.formData(), file = form.get("file"), wiId = String(form.get("wiId") || "");
    if (!(file instanceof File) || !/\.docx$/i.test(file.name) || file.size > 3 * 1024 * 1024) throw new Error("Selecciona el formato oficial en DOCX, de hasta 3 MB.");
    const zip = new PizZip(Buffer.from(await file.arrayBuffer())), entry = zip.file("word/document.xml");
    if (!entry) throw new Error("El archivo no es un documento Word válido.");
    // Check the advertised inflated size before decompressing an untrusted DOCX.
    const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
    if (size && size > 5 * 1024 * 1024) throw new Error("El contenido del documento es demasiado grande.");
    const xml = entry.asText(); if (xml.length > 5 * 1024 * 1024) throw new Error("Documento demasiado grande.");
    const imported = importPdoXml(xml, wiId);
    return NextResponse.json({ ...imported, details: { ...imported.details, sourceFile: file.name } });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
