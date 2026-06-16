export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { adminDB } from "../../../../../lib/firebaseAdmin";

const libre = require("libreoffice-convert");
libre.convertAsync = require("util").promisify(libre.convert);

type ArchivoAnexo = {
  nombre?: string;
  name?: string;
  filename?: string;
  fileName?: string;
  url?: string;
  downloadURL?: string;
  downloadUrl?: string;
  fileUrl?: string;
  tipo?: string;
  mimeType?: string;
  type?: string;
  contentType?: string;
  descripcion?: string;
  titulo?: string;
  title?: string;
  renderUrl?: string;
  thumbnailUrl?: string;
};

function clean(value: any) {
  if (value === undefined || value === null || value === "") return "NA";
  if (Array.isArray(value)) return value.length ? value.join("\n") : "NA";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

function initials(name: string) {
  if (!name || name === "NA") return "NA";

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function extension(nombre = "") {
  return nombre.split(".").pop()?.toLowerCase() || "";
}

function getFileName(file: ArchivoAnexo) {
  return (
    file.nombre ||
    file.name ||
    file.filename ||
    file.fileName ||
    file.titulo ||
    file.title ||
    "archivo"
  );
}

function getFileTitle(file: ArchivoAnexo) {
  return (
    file.titulo ||
    file.title ||
    file.descripcion ||
    file.nombre ||
    file.name ||
    file.filename ||
    file.fileName ||
    "Archivo"
  );
}

function getFileUrl(file: ArchivoAnexo) {
  return file.url || file.downloadURL || file.downloadUrl || file.fileUrl || "";
}

function getMimeType(file: ArchivoAnexo) {
  return file.mimeType || file.type || file.contentType || "";
}

function isImage(file: ArchivoAnexo) {
  const ext = extension(getFileName(file));
  const mime = getMimeType(file);

  return (
    mime.startsWith("image/") ||
    ["jpg", "jpeg", "png"].includes(ext)
  );
}

function isPdf(file: ArchivoAnexo) {
  const ext = extension(getFileName(file));
  const mime = getMimeType(file);

  return mime === "application/pdf" || ext === "pdf";
}

function isCad(file: ArchivoAnexo) {
  const ext = extension(getFileName(file));

  return ["stl", "step", "stp", "dxf", "f3d", "f3z", "obj", "3mf"].includes(
    ext
  );
}

async function urlToBytes(url: string) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`No se pudo descargar archivo: ${url}`);
  }

  return new Uint8Array(await res.arrayBuffer());
}

function collectFilesFromObject(obj: any): ArchivoAnexo[] {
  const files: ArchivoAnexo[] = [];

  function walk(value: any) {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    if (typeof value === "object") {
      const possibleUrl =
        value.url || value.downloadURL || value.downloadUrl || value.fileUrl;

      if (possibleUrl) {
        files.push({
          nombre: value.nombre,
          name: value.name,
          filename: value.filename,
          fileName: value.fileName,
          url: value.url,
          downloadURL: value.downloadURL,
          downloadUrl: value.downloadUrl,
          fileUrl: value.fileUrl,
          tipo: value.tipo,
          mimeType: value.mimeType,
          type: value.type,
          contentType: value.contentType,
          descripcion: value.descripcion,
          titulo: value.titulo,
          title: value.title,
          renderUrl: value.renderUrl,
          thumbnailUrl: value.thumbnailUrl,
        });
      }

      Object.values(value).forEach(walk);
    }
  }

  walk(obj);
  return files;
}

async function addTitlePage(pdfDoc: PDFDocument, title: string) {
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawText(title, {
    x: 50,
    y: 720,
    size: 18,
    font,
    color: rgb(0, 0, 0),
  });

  return page;
}

async function addTextToLastPage(pdfDoc: PDFDocument, text: string) {
  const pages = pdfDoc.getPages();
  const page = pages[pages.length - 1];
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText(text, {
    x: 50,
    y: 685,
    size: 11,
    font,
    color: rgb(0, 0, 0),
    maxWidth: 500,
  });
}

async function addImagePage(pdfDoc: PDFDocument, file: ArchivoAnexo) {
  const url = getFileUrl(file);
  if (!url) return;

  const bytes = await urlToBytes(url);
  const ext = extension(getFileName(file));

  const page = pdfDoc.addPage([612, 792]);
  const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawText(`${getFileTitle(file)}:`, {
    x: 50,
    y: 735,
    size: 14,
    font: titleFont,
    color: rgb(0, 0, 0),
  });

  let image;

  if (ext === "jpg" || ext === "jpeg") {
    image = await pdfDoc.embedJpg(bytes);
  } else {
    image = await pdfDoc.embedPng(bytes);
  }

  const maxWidth = 500;
  const maxHeight = 620;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);

  const width = image.width * scale;
  const height = image.height * scale;

  page.drawImage(image, {
    x: (612 - width) / 2,
    y: 90,
    width,
    height,
  });
}

async function appendPdf(pdfDoc: PDFDocument, file: ArchivoAnexo) {
  const url = getFileUrl(file);
  if (!url) return;

  await addTitlePage(pdfDoc, `${getFileTitle(file)}:`);

  const bytes = await urlToBytes(url);
  const attachedPdf = await PDFDocument.load(bytes);

  const copiedPages = await pdfDoc.copyPages(
    attachedPdf,
    attachedPdf.getPageIndices()
  );

  copiedPages.forEach((page) => pdfDoc.addPage(page));
}

async function addCadPage(pdfDoc: PDFDocument, file: ArchivoAnexo) {
  const page = pdfDoc.addPage([612, 792]);

  const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText(`${getFileTitle(file)}:`, {
    x: 50,
    y: 735,
    size: 14,
    font: titleFont,
    color: rgb(0, 0, 0),
  });

  page.drawText(`Archivo: ${getFileName(file)}`, {
    x: 50,
    y: 705,
    size: 11,
    font,
    color: rgb(0, 0, 0),
  });

  const preview = file.renderUrl || file.thumbnailUrl;

  if (!preview) {
    page.drawText(
      "Vista previa CAD no disponible todavía. El archivo original queda registrado como anexo de la solicitud.",
      {
        x: 50,
        y: 675,
        size: 11,
        font,
        color: rgb(0, 0, 0),
        maxWidth: 500,
      }
    );
    return;
  }

  const bytes = await urlToBytes(preview);
  const image = await pdfDoc.embedPng(bytes);

  const maxWidth = 500;
  const maxHeight = 600;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);

  const width = image.width * scale;
  const height = image.height * scale;

  page.drawImage(image, {
    x: (612 - width) / 2,
    y: 90,
    width,
    height,
  });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ pedidoId: string }> }
) {
  try {
    const { pedidoId } = await context.params;

    const pedidoSnap = await adminDB.collection("pedidos").doc(pedidoId).get();

    if (!pedidoSnap.exists) {
      return NextResponse.json(
        { error: "No se encontró el pedido." },
        { status: 404 }
      );
    }

    const pedido: any = {
      id: pedidoSnap.id,
      ...pedidoSnap.data(),
    };

    const fixture = pedido.fixtureSolicitud || {};
    const necesidad = fixture.necesidad || {};
    const alcance = fixture.alcance || {};
    const inputs = fixture.inputs || {};

    const archivosSnap = await adminDB
      .collection("pedidos")
      .doc(pedidoId)
      .collection("archivosFixture")
      .get();

    const archivosSubcollection = archivosSnap.docs.flatMap((d) =>
      collectFilesFromObject(d.data())
    );

    const archivosPedido = collectFilesFromObject(pedido);

    const archivos = [...archivosPedido, ...archivosSubcollection].filter(
      (file, index, self) => {
        const url = getFileUrl(file);
        return url && index === self.findIndex((f) => getFileUrl(f) === url);
      }
    );

    const templatePath = path.join(
      process.cwd(),
      "public",
      "templates",
      "Solicitud_formal_template.docx"
    );

    const content = await fs.readFile(templatePath);

    const zip = new PizZip(content);

    const docx = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    const solicitante =
      pedido.solicitanteNombre ||
      pedido.nombreSolicitante ||
      pedido.nombre ||
      pedido.usuarioNombre ||
      pedido.solicitante ||
      pedido.email ||
      "NA";

    docx.render({
      titulo: clean(pedido.titulo || pedido.title),
      idReferencia: clean(
        pedido.idReferencia || pedido.ioId || pedido.referencia || pedido.id
      ),
      proyecto: clean(pedido.proyecto),
      solicitante: clean(solicitante),

      problematica: clean(necesidad.problematica || fixture.problematica),
      piezasProducto: clean(
        necesidad.piezasProducto || fixture.piezasProducto
      ),

      alcance: clean(alcance.descripcion || fixture.alcance),
      procesos: clean(alcance.procesos || fixture.procesos),

      cuartoLimpio: clean(inputs.cuartoLimpio),

      horno: clean(
        inputs.horno
          ? inputs.temperaturaMax
            ? `Sí, temperatura máxima: ${inputs.temperaturaMax}`
            : "Sí"
          : "NA"
      ),

      rigidezDureza: clean(
        inputs.rigidezDureza
          ? inputs.rigidezDetalle || "Sí"
          : inputs.rigidezDetalle || "NA"
      ),

      esterilizable: clean(inputs.esterilizable),

      equipos: clean(
        inputs.requiereEquipo
          ? `${inputs.equipoId || ""} ${inputs.equipoNombre || ""}`.trim()
          : inputs.equipoNombre || inputs.equipoId || "NA"
      ),

      dimensionesCriticas: clean(
        inputs.dimensionesCriticas
          ? inputs.referenciaDWG || "Sí"
          : inputs.noTieneDimensiones
          ? "No tiene dimensiones críticas definidas"
          : inputs.referenciaDWG || "NA"
      ),

      tiempoTrabajo: clean(inputs.tiempoTrabajo),
      reportarPresupuesto: clean(inputs.presupuestoPM),
      masEspecificaciones: clean(inputs.extra),

      criteriosExito: clean(fixture.criteriosExito),
      firmaPM: clean(initials(solicitante)),
    });

    const filledDocxBuffer = docx.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    const pdfBuffer = await libre.convertAsync(
      filledDocxBuffer,
      ".pdf",
      undefined
    );

    const pdfDoc = await PDFDocument.load(pdfBuffer);

    const imagenes = archivos.filter(isImage);
    const pdfs = archivos.filter(isPdf);
    const cads = archivos.filter(isCad);

    if (imagenes.length || pdfs.length || cads.length) {
      await addTitlePage(pdfDoc, "Documentos anexos");
      await addTextToLastPage(
        pdfDoc,
        "Los siguientes documentos fueron agregados automáticamente por el sistema."
      );
    }

    for (const img of imagenes) {
      await addImagePage(pdfDoc, img);
    }

    for (const pdf of pdfs) {
      await appendPdf(pdfDoc, pdf);
    }

    for (const cad of cads) {
      await addCadPage(pdfDoc, cad);
    }

    const finalPdf = await pdfDoc.save();

    const fileName = `${pedido.titulo || "solicitud-formal"}.pdf`
      .replace(/[^\w\dáéíóúÁÉÍÓÚñÑ.-]+/g, "_")
      .replace(/_+/g, "_");

    return new NextResponse(Buffer.from(finalPdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Error generando solicitud formal:", error);

    return NextResponse.json(
      {
        error: "No se pudo generar la solicitud formal.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}