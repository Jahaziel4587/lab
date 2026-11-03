export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import PizZip from "pizzip";
import { descriptionWidths, versionPhotos, renderSummary } from "../../../../../lib/fixtures/summary-docx";
import { adminDB } from "../../../../../lib/firebaseAdmin";

function clean(value: any) {
  if (value === undefined || value === null || value === "") return "NA";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "NA";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

function formatMoney(value: number) {
  return `MXN ${Number(value || 0).toFixed(2)}`;
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

async function getQuoteTotal(pedidoId: string) {
  const linesSnap = await adminDB
    .collection("pedidos")
    .doc(pedidoId)
    .collection("quote_live")
    .doc("live")
    .collection("lines")
    .get();

  let total = 0;

  linesSnap.forEach((line) => {
    const data = line.data() as any;
    total += Number(data.subtotalMXN || 0);
  });

  return total;
}

async function getPedidosAsociados(fixtureId: string) {
  const pedidosSnap = await adminDB.collection("pedidos").get();
  const rows: any[] = [];

  for (const docSnap of pedidosSnap.docs) {
    const data = docSnap.data() as any;

    if (data.fixtureRelacionadoId === fixtureId) {
      const totalCotizado = await getQuoteTotal(docSnap.id);

      rows.push({
        id: docSnap.id,
        titulo: data.titulo || docSnap.id,
        servicio: data.servicio || "NA",
        fase: data.fixtureRelacionadoFase || "NA",
        version: data.fixtureRelacionadoVersion || "NA",
        subtotal:
          totalCotizado ||
          Number(data.subtotalMXN || data.totalMXN || data.costo || 0),
      });
    }
  }

  return rows;
}

function pedidosToText(pedidos: any[]) {
  if (!pedidos.length) return "NA";

  return pedidos
    .map(
      (p, index) =>
        `${index + 1}. ${p.titulo} | ${p.servicio} | ${formatMoney(p.subtotal)}`
    )
    .join("\n");
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
        { error: "Pedido no encontrado." },
        { status: 404 }
      );
    }

    const pedido: any = {
      id: pedidoSnap.id,
      ...pedidoSnap.data(),
    };

    const solicitante = await getNombreUsuarioPorCorreo(pedido.correoUsuario);

    const conceptosSnap = await adminDB
      .collection("pedidos")
      .doc(pedidoId)
      .collection("fixture_conceptos")
      .orderBy("createdAt", "asc")
      .get();

    const pruebasSnap = await adminDB
      .collection("pedidos")
      .doc(pedidoId)
      .collection("fixture_pruebas")
      .orderBy("createdAt", "asc")
      .get();

    const conceptos = conceptosSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as any),
    }));

    const pruebas = pruebasSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as any),
    }));

    const pedidosAsociados = await getPedidosAsociados(pedidoId);

    const templatePath = path.join(
      process.cwd(),
      "public",
      "templates",
      "Spec_draft_template.docx"
    );

    const content = await fs.readFile(templatePath);
    const zip = new PizZip(content);

    const widths = descriptionWidths(zip);
    if (widths.length !== 2) throw new Error("La plantilla debe contener una celda de fotos en cada tabla de versiones.");
    const estatus = (status: string) => status === "aprobado" ? "Aprobada" : status === "rechazado" ? "Rechazada" : "Pendiente";
    const especificacionesExtra = [];
    for (const concepto of conceptos) {
      especificacionesExtra.push({
        version: clean(concepto.versionLabel),
        especificacion: clean((concepto.especificacionesExtra || []).join("\n")),
        descripcion: clean(concepto.descripcion),
        estatus: estatus(concepto.status),
        fotos: await versionPhotos(concepto.archivos, pedidoId, widths[0]),
      });
    }
    const pruebasDiseno = [];
    for (const prueba of pruebas) {
      pruebasDiseno.push({
        version: clean(prueba.versionLabel),
        descripcion: clean(prueba.descripcion),
        pedidosAsociados: pedidosToText(pedidosAsociados.filter(p => p.fase === "prueba" && p.version === prueba.versionLabel)),
        estatus: estatus(prueba.status),
        fotos: await versionPhotos(prueba.archivos, pedidoId, widths[1]),
      });
    }
    const finalDocx = renderSummary(zip, {
      titulo: clean(pedido.titulo), idReferencia: clean(pedido.io),
      proyecto: clean(pedido.proyecto), solicitante: clean(solicitante),
      especificacionesExtra, pruebasDiseno,
    });

    const body = new Uint8Array(finalDocx);

    const fileName = `${pedido.titulo || "Spec Draft"}.docx`
      .replace(/[^\w\dáéíóúÁÉÍÓÚñÑ.-]+/g, "_")
      .replace(/_+/g, "_");

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Error generando Spec Draft:", error);

    return NextResponse.json(
      {
        error: "No se pudo generar el Spec Draft.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}