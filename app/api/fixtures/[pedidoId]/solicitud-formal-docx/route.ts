export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { adminDB } from "../../../../../lib/firebaseAdmin";

type ArchivoAnexo = {
  nombre?: string;
  name?: string;
  filename?: string;
  fileName?: string;
  url?: string;
  downloadURL?: string;
  downloadUrl?: string;
  fileUrl?: string;
  titulo?: string;
  title?: string;
  descripcion?: string;
};

function clean(value: any) {
  if (value === undefined || value === null || value === "") return "NA";
  if (Array.isArray(value)) return value.length ? value.join("\n") : "NA";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
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

function getFileUrl(file: ArchivoAnexo) {
  return file.url || file.downloadURL || file.downloadUrl || file.fileUrl || "";
}

function getFileTitle(file: ArchivoAnexo) {
  return file.titulo || file.title || file.descripcion || getFileName(file);
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
          titulo: value.titulo,
          title: value.title,
          descripcion: value.descripcion,
        });
      }

      Object.values(value).forEach(walk);
    }
  }

  walk(obj);
  return files;
}

function buildDocumentosAnexos(files: ArchivoAnexo[]) {
  if (!files.length) return "NA";

  return files
    .map((file, index) => {
      const title = getFileTitle(file);
      const name = getFileName(file);
      const url = getFileUrl(file);

      return `${index + 1}. ${title}\nArchivo: ${name}\nLink: ${url}`;
    })
    .join("\n\n");
}

async function getNombreUsuarioPorCorreo(correo?: string) {
  if (!correo) return "NA";

  const usersSnap = await adminDB.collection("users").get();
  let nombre = "";

  usersSnap.forEach((docSnap) => {
    const data = docSnap.data() as any;

    if (
      String(data?.email || "").toLowerCase() ===
      String(correo).toLowerCase()
    ) {
      nombre =
        [data?.nombre, data?.apellido].filter(Boolean).join(" ") ||
        data?.displayName ||
        "";
    }
  });

  return nombre || correo || "NA";
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

    const solicitante = await getNombreUsuarioPorCorreo(pedido.correoUsuario);

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

    docx.render({
      titulo: clean(pedido.titulo || pedido.title),

      // ID proporcionado por el PM en la solicitud formal
      idReferencia: clean(pedido.io),

      proyecto: clean(pedido.proyecto),
      solicitante: clean(solicitante),

      problematica: clean(necesidad.problematica || fixture.problematica),
      piezasProducto: clean(necesidad.piezasProducto || fixture.piezasProducto),

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

      // Si ya borraste {firmaPM} del DOCX, esto no se usa.
      firmaPM: "",

      documentosAnexos: buildDocumentosAnexos(archivos),
    });
const fileName = `${pedido.titulo || "solicitud-formal"}.docx`
      .replace(/[^\w\dáéíóúÁÉÍÓÚñÑ.-]+/g, "_")
      .replace(/_+/g, "_");

 const finalDocx = docx.getZip().generate({
  type: "nodebuffer",
  compression: "DEFLATE",
});

const body = new Uint8Array(finalDocx);

return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Error generando solicitud formal DOCX:", error);

    return NextResponse.json(
      {
        error: "No se pudo generar la solicitud formal.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}