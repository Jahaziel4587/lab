import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");
const ADMIN_EMAILS = defineSecret("ADMIN_EMAILS");

// Ajusta si cambias el dominio de producción
const APP_BASE_URL = process.env.APP_BASE_URL || "https://bioanaprotolab.com/";

if (!admin.apps.length) {
  admin.initializeApp();
}

const pretty = (v: any) => {
  if (v === undefined || v === null) return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object" && typeof (v as any).toDate === "function") {
    // Timestamp de Firestore
    return (v as any).toDate().toISOString();
  }
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
};

export const onPedidoCreatedSendEmail = onDocumentCreated(
  {
    document: "pedidos/{pedidoId}",
    secrets: [SENDGRID_API_KEY, ADMIN_EMAILS],
    region: "us-central1", // ← región válida
  },
  async (event) => {
    try {
      const snap = event.data;
      if (!snap) return;

      const pedidoId = event.params.pedidoId as string;
      const p = snap.data() as any;

      const {
        titulo,
        proyecto,
        servicio,
        maquina,
        material,
        tecnica,
        explicacion,
        archivos,
        videoURL,
        fecha,
        usuario,
        createdAt,
      } = p;

      const detalleURL = `${APP_BASE_URL}/solicitudes/listado/${pedidoId}`;

      const archivosList = Array.isArray(archivos) && archivos.length
        ? `<ul>${archivos.map((u: string) => `<li><a href="${u}">${u}</a></li>`).join("")}</ul>`
        : "—";

      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.45;font-size:14px;color:#111">
          <h2 style="margin:0 0 12px">🧾 Nuevo pedido recibido</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0"><strong>ID:</strong></td><td style="padding:6px 0">${pedidoId}</td></tr>
            <tr><td style="padding:6px 0"><strong>Título:</strong></td><td style="padding:6px 0">${pretty(titulo)}</td></tr>
            <tr><td style="padding:6px 0"><strong>Proyecto:</strong></td><td style="padding:6px 0">${pretty(proyecto)}</td></tr>
            <tr><td style="padding:6px 0"><strong>Servicio:</strong></td><td style="padding:6px 0">${pretty(servicio)}</td></tr>
            <tr><td style="padding:6px 0"><strong>Máquinas:</strong></td><td style="padding:6px 0">${pretty(maquina)}</td></tr>
            <tr><td style="padding:6px 0"><strong>Materiales:</strong></td><td style="padding:6px 0">${pretty(material)}</td></tr>
            <tr><td style="padding:6px 0"><strong>Técnica:</strong></td><td style="padding:6px 0">${pretty(tecnica)}</td></tr>
            <tr><td style="padding:6px 0;vertical-align:top"><strong>Especificaciones:</strong></td><td style="padding:6px 0;white-space:pre-wrap">${pretty(explicacion)}</td></tr>
            <tr><td style="padding:6px 0;vertical-align:top"><strong>Archivos:</strong></td><td style="padding:6px 0">${archivosList}</td></tr>
            <tr><td style="padding:6px 0"><strong>Video:</strong></td><td style="padding:6px 0">${videoURL ? `<a href="${videoURL}">${videoURL}</a>` : "—"}</td></tr>
            <tr><td style="padding:6px 0"><strong>Entrega propuesta:</strong></td><td style="padding:6px 0">${pretty(fecha)}</td></tr>
            <tr><td style="padding:6px 0"><strong>Solicitante:</strong></td><td style="padding:6px 0">${pretty(usuario)}</td></tr>
            <tr><td style="padding:6px 0"><strong>Creado:</strong></td><td style="padding:6px 0">${pretty(createdAt)}</td></tr>
          </table>
          <hr style="border:none;border-top:1px solid #ddd;margin:12px 0"/>
          <p>Ver detalles: <a href="${detalleURL}">${detalleURL}</a></p>
        </div>
      `;

      sgMail.setApiKey(SENDGRID_API_KEY.value());

      const adminEmails = ADMIN_EMAILS.value()
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (!adminEmails.length) {
        logger.error("ADMIN_EMAILS está vacío.");
        return;
      }

      await sgMail.sendMultiple({
        to: adminEmails,
        from: { email: "jahaziel4587@gmail.com", name: "Laboratorio Bioana" }, // tu Single Sender
        subject: `Nuevo pedido: ${titulo ?? pedidoId}`,
        html,
      });

      logger.info(`Correo enviado a: ${adminEmails.join(", ")}`);
    } catch (err) {
      logger.error("Error enviando correo de nuevo pedido", err);
      throw err;
    }
  }
);
