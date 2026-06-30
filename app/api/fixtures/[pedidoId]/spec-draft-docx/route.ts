export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
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

    const fixture = pedido.fixtureSolicitud || {};
    const necesidad = fixture.necesidad || {};
    const alcance = fixture.alcance || {};
    const inputs = fixture.inputs || {};

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

    const especificacionesExtra = conceptos.flatMap((concepto) => {
      const specs = Array.isArray(concepto.especificacionesExtra)
        ? concepto.especificacionesExtra
        : [];

      if (!specs.length) {
        return [
          {
            version: clean(concepto.versionLabel),
            especificacion: "NA",
            descripcion: clean(concepto.descripcion),
          },
        ];
      }

      return specs.map((spec: string) => ({
        version: clean(concepto.versionLabel),
        especificacion: clean(spec),
        descripcion: clean(concepto.descripcion),
      }));
    });

    const conceptoAprobado =
      [...conceptos].reverse().find((c) => c.status === "aprobado") || null;

    const pruebasDiseno = pruebas.map((prueba) => {
      const pedidosDePrueba = pedidosAsociados.filter(
        (p) =>
          p.fase === "prueba" &&
          p.version === prueba.versionLabel
      );

      return {
        version: clean(prueba.versionLabel),
        descripcion: clean(prueba.descripcion),
        pedidosAsociados: pedidosToText(pedidosDePrueba),
      };
    });

    const pruebaAprobada =
      [...pruebas].reverse().find((p) => p.status === "aprobado") || null;

    const pedidosVersionFinal = pruebaAprobada
      ? pedidosAsociados.filter(
          (p) =>
            p.fase === "prueba" &&
            p.version === pruebaAprobada.versionLabel
        )
      : [];

    const costoVersionFinal = pedidosVersionFinal.reduce(
      (sum, p) => sum + Number(p.subtotal || 0),
      0
    );

    const templatePath = path.join(
      process.cwd(),
      "public",
      "templates",
      "Spec_draft_template.docx"
    );

    const content = await fs.readFile(templatePath);
    const zip = new PizZip(content);

    const docx = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    docx.render({
      titulo: clean(pedido.titulo),
      idReferencia: clean(pedido.io),
      proyecto: clean(pedido.proyecto),
      solicitante: clean(solicitante),

      problematica: clean(necesidad.problematica),
      piezasProducto: clean(necesidad.piezasProducto),

      alcance: clean(alcance.descripcion),
      procesos: clean(alcance.procesos),

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

      especificacionesExtra:
        especificacionesExtra.length > 0
          ? especificacionesExtra
          : [
              {
                version: "NA",
                especificacion: "NA",
                descripcion: "NA",
              },
            ],

      conceptoAprobadoVersion: clean(conceptoAprobado?.versionLabel),
      conceptoAprobadoDescripcion: clean(conceptoAprobado?.descripcion),

      pruebasDiseno:
        pruebasDiseno.length > 0
          ? pruebasDiseno
          : [
              {
                version: "NA",
                descripcion: "NA",
                pedidosAsociados: "NA",
              },
            ],

      versionFinal: clean(pruebaAprobada?.versionLabel),
      versionFinalDescripcion: clean(pruebaAprobada?.descripcion),
      versionFinalPedidos: pedidosToText(pedidosVersionFinal),
      versionFinalCosto: formatMoney(costoVersionFinal),
    });

    const finalDocx = docx.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
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