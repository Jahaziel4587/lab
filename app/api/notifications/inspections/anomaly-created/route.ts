import {
  NextRequest,
  NextResponse,
} from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminAuth,
  adminDB,
} from "@/lib/firebaseAdmin";
import {
  getDisplayNameForUid,
  sendPushToEmails,
} from "@/lib/pushNotifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notificationOrigin(
  request: NextRequest,
) {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (!configured) {
    return request.nextUrl.origin;
  }

  return configured.startsWith("http")
    ? configured
    : `https://${configured}`;
}

function cleanString(
  value: unknown,
) {
  return String(value || "").trim();
}

function normalizeEmail(
  value: unknown,
) {
  return cleanString(value).toLowerCase();
}

export async function POST(
  request: NextRequest,
) {
  try {
    const authorization =
      request.headers.get(
        "authorization",
      );

    if (
      !authorization?.startsWith(
        "Bearer ",
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "No autorizado.",
        },
        {
          status: 401,
        },
      );
    }

    const idToken =
      authorization.slice(
        "Bearer ".length,
      );

    const decoded =
      await adminAuth.verifyIdToken(
        idToken,
      );

    const body =
      await request.json();

    const scopeKey =
      cleanString(body?.scopeKey);

    const anomalyId =
      cleanString(body?.anomalyId);

    const occurrenceId =
      cleanString(body?.occurrenceId);

    if (
      !scopeKey ||
      !anomalyId ||
      !occurrenceId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta información del reporte.",
        },
        {
          status: 400,
        },
      );
    }

    const scopeReference =
      adminDB
        .collection(
          "inspection_anomalies",
        )
        .doc(scopeKey);

    const anomalyReference =
      scopeReference
        .collection("anomalies")
        .doc(anomalyId);

    const occurrenceReference =
      anomalyReference
        .collection("occurrences")
        .doc(occurrenceId);

    const [
      scopeSnapshot,
      anomalySnapshot,
      occurrenceSnapshot,
    ] = await Promise.all([
      scopeReference.get(),
      anomalyReference.get(),
      occurrenceReference.get(),
    ]);

    if (
      !scopeSnapshot.exists ||
      !anomalySnapshot.exists ||
      !occurrenceSnapshot.exists
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El reporte de anormalidad no existe.",
        },
        {
          status: 404,
        },
      );
    }

    const scope =
      scopeSnapshot.data() || {};

    const anomaly =
      anomalySnapshot.data() || {};

    const occurrence =
      occurrenceSnapshot.data() || {};

    /*
     * Solo quien creó el reporte puede solicitar
     * esta notificación inicial.
     */
    if (
      cleanString(
        occurrence.createdByUid,
      ) !== decoded.uid
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No tienes permiso para enviar esta notificación.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * El destinatario se obtiene del documento
     * guardado, no del contenido enviado por
     * el navegador.
     */
    const responsiblePmEmail =
      normalizeEmail(
        anomaly.responsiblePmEmail ||
        occurrence.responsiblePmEmail,
      );

    if (!responsiblePmEmail) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El reporte no tiene un PM responsable.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Evita notificar dos veces cuando el usuario
     * recarga o repite accidentalmente la llamada.
     */
    if (
      anomaly.notifications
        ?.initialReportSent === true
    ) {
      return NextResponse.json({
        ok: true,
        alreadyNotified: true,
      });
    }

    const inspectorName =
      await getDisplayNameForUid(
        decoded.uid,
        decoded.email,
      );

    const sourceType =
      cleanString(scope.sourceType);

    const projectName =
      cleanString(scope.projectName);

    const wiTitle =
      cleanString(scope.wiTitle) ||
      "Work instruction";

    const processComponentTitle =
      cleanString(
        scope.processComponentTitle,
      );

    const inspectedItem =
      processComponentTitle ||
      wiTitle;

    const lot =
      cleanString(occurrence.lot);

    const affectedQuantity =
      Number(
        occurrence.affectedQuantity || 0,
      );

    const sampleQuantity =
      Number(
        occurrence.sampleQuantity || 0,
      );

    const title =
      "Nueva anormalidad";

    const notificationBody =
      `${inspectorName} reportó ` +
      `la muestra ${affectedQuantity} de ` +
      `${sampleQuantity} ` +
      `en ${inspectedItem}` +
      `${lot ? `, lote ${lot}` : ""}.`;

    const inspectionType =
      sourceType === "proceso"
        ? "proceso"
        : "entrada";

    const urlParameters =
      new URLSearchParams();

    if (
      sourceType === "entrada_mts"
    ) {
      urlParameters.set(
        "origen",
        "mts",
      );
    } else if (projectName) {
      urlParameters.set(
        "origen",
        "proyectos",
      );
    }

    if (scope.projectId) {
      urlParameters.set(
        "proyecto",
        cleanString(
          scope.projectId,
        ),
      );
    }

    if (scope.wiCode) {
      urlParameters.set(
        "wi",
        cleanString(
          scope.wiCode,
        ),
      );
    }

    if (scope.processComponentId) {
      urlParameters.set(
        "componente",
        cleanString(
          scope.processComponentId,
        ),
      );
    }

    urlParameters.set(
      "hallazgo",
      "anormalidad",
    );

    urlParameters.set(
      "anomalia",
      anomalyId,
    );

    const relativeUrl =
      `/inspecciones/${inspectionType}` +
      `?${urlParameters.toString()}`;

    const absoluteUrl =
      new URL(
        relativeUrl,
        notificationOrigin(request),
      ).toString();

    const pushResult =
      await sendPushToEmails({
        emails: [
          responsiblePmEmail,
        ],
        title,
        body: notificationBody,
        url: absoluteUrl,
      });

    /*
     * Notificación interna para la campana.
     */
    await adminDB
      .collection("notifications")
      .add({
        userEmail:
          responsiblePmEmail,
        tipo:
          "inspection_anomaly_created",
        mensaje:
          notificationBody,

        inspectionType,
        scopeKey,
        anomalyId,
        occurrenceId,

        projectId:
          cleanString(
            scope.projectId,
          ),
        projectName,
        wiCode:
          cleanString(
            scope.wiCode,
          ),
        wiTitle,
        processComponentId:
          cleanString(
            scope.processComponentId,
          ),
        processComponentTitle,

        url:
          relativeUrl,

        createdAt:
          FieldValue.serverTimestamp(),
        leido: false,
      });

    await anomalyReference.set(
      {
        notifications: {
          initialReportSent: true,
          initialReportSentAt:
            FieldValue.serverTimestamp(),
          initialReportRecipient:
            responsiblePmEmail,
        },
        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      },
    );

    return NextResponse.json({
      ok: true,
      recipientEmail:
        responsiblePmEmail,
      ...pushResult,
    });
  } catch (error) {
    console.error(
      "[inspection anomaly notification]",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo enviar la notificación.",
      },
      {
        status: 500,
      },
    );
  }
}
