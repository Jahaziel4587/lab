import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  FieldValue,
} from "firebase-admin/firestore";

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

function cleanString(
  value: unknown,
) {
  return String(
    value || "",
  ).trim();
}

function normalizeEmail(
  value: unknown,
) {
  return cleanString(
    value,
  ).toLowerCase();
}

function notificationOrigin(
  request: NextRequest,
) {
  const configured =
    process.env
      .NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env
      .VERCEL_PROJECT_PRODUCTION_URL;

  if (!configured) {
    return request.nextUrl.origin;
  }

  return configured.startsWith(
    "http",
  )
    ? configured
    : `https://${configured}`;
}

function buildNotificationDocumentId(
  lotId: string,
  email: string,
) {
  const encodedEmail =
    Buffer.from(email)
      .toString("base64url");

  return (
    "inspection_nc_" +
    `${lotId}_` +
    `${encodedEmail}`
  );
}

function buildInspectionUrl(
  scope:
    Record<string, unknown>,
  lotId: string,
) {
  const sourceType =
    cleanString(
      scope.sourceType,
    );

  const inspectionType =
    sourceType === "proceso"
      ? "proceso"
      : "entrada";

  const parameters =
    new URLSearchParams();

  if (
    sourceType ===
    "entrada_mts"
  ) {
    parameters.set(
      "origen",
      "mts",
    );
  } else if (
    sourceType ===
    "entrada_proyecto"
  ) {
    parameters.set(
      "origen",
      "proyectos",
    );
  }

  const projectId =
    cleanString(
      scope.projectId,
    );

  const wiCode =
    cleanString(
      scope.wiCode,
    );

  const processComponentId =
    cleanString(
      scope.processComponentId,
    );

  if (projectId) {
    parameters.set(
      "proyecto",
      projectId,
    );
  }

  if (wiCode) {
    parameters.set(
      "wi",
      wiCode,
    );
  }

  if (processComponentId) {
    parameters.set(
      "componente",
      processComponentId,
    );
  }

  parameters.set(
    "hallazgo",
    "no_conformidad",
  );

  parameters.set(
    "lote",
    lotId,
  );

  return (
    `/inspecciones/${inspectionType}` +
    `?${parameters.toString()}`
  );
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
          error:
            "No autorizado.",
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
      await adminAuth
        .verifyIdToken(
          idToken,
        );

    const body =
      await request.json();

    const scopeKey =
      cleanString(
        body?.scopeKey,
      );

    const lotId =
      cleanString(
        body?.lotId,
      );

    if (
      !scopeKey ||
      !lotId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta información del lote.",
        },
        {
          status: 400,
        },
      );
    }

    const scopeReference =
      adminDB
        .collection(
          "inspection_nonconformities",
        )
        .doc(scopeKey);

    const lotReference =
      scopeReference
        .collection("lots")
        .doc(lotId);

    const [
      scopeSnapshot,
      lotSnapshot,
    ] =
      await Promise.all([
        scopeReference.get(),
        lotReference.get(),
      ]);

    if (
      !scopeSnapshot.exists ||
      !lotSnapshot.exists
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El lote no existe.",
        },
        {
          status: 404,
        },
      );
    }

    const scope =
      scopeSnapshot.data() || {};

    const lot =
      lotSnapshot.data() || {};

    if (
      lot.status !==
      "finalized"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El lote todavía no ha sido finalizado.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Solo el inspector que finalizó el
     * lote puede solicitar esta
     * notificación.
     */
    if (
      cleanString(
        lot.finalizedByUid,
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
     * Evita volver a notificar si el
     * navegador repite la petición.
     */
    if (
      lot.notifications
        ?.finalizedSent === true
    ) {
      return NextResponse.json({
        ok: true,
        alreadyNotified: true,
      });
    }

    const responsiblePmEmail =
      normalizeEmail(
        lot.responsiblePmEmail,
      );

    /*
     * Los responsables de Calidad se
     * identifican con:
     *
     * isQualityManager: true
     */
    const qualityManagersSnapshot =
      await adminDB
        .collection("users")
        .where(
          "isQualityManager",
          "==",
          true,
        )
        .get();

    const qualityManagerEmails =
      qualityManagersSnapshot.docs
        .map((userDocument) =>
          normalizeEmail(
            userDocument.data()
              .email,
          ),
        )
        .filter(Boolean);

    const recipientEmails =
      Array.from(
        new Set([
          responsiblePmEmail,
          ...qualityManagerEmails,
        ].filter(Boolean)),
      );

    if (
      recipientEmails.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No se encontró al PM ni a un Quality Manager para notificar.",
        },
        {
          status: 400,
        },
      );
    }

    const inspectorName =
      cleanString(
        lot.finalizedByName,
      ) ||
      await getDisplayNameForUid(
        decoded.uid,
        decoded.email,
      );

    const lotName =
      cleanString(
        lot.lotName,
      ) ||
      "Sin nombre";

    const rejectedSampleCount =
      Number(
        lot.rejectedSampleCount ||
          0,
      );

    const sampleQuantity =
      Number(
        lot.sampleQuantity ||
          0,
      );

    if (
      !Number.isInteger(
        rejectedSampleCount,
      ) ||
      rejectedSampleCount < 1
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El lote no contiene una cantidad válida de muestras rechazadas.",
        },
        {
          status: 400,
        },
      );
    }

    const rejectedText =
      rejectedSampleCount === 1
        ? "1 pieza fue rechazada"
        : `${rejectedSampleCount} piezas ` +
          "fueron rechazadas";

    const title =
      "Lote con rechazos por SPEC";

    const notificationBody =
      `${inspectorName} registró que ` +
      `para el lote "${lotName}", ` +
      `${rejectedText}.`;

    const relativeUrl =
      buildInspectionUrl(
        scope,
        lotId,
      );

    const absoluteUrl =
      new URL(
        relativeUrl,
        notificationOrigin(
          request,
        ),
      ).toString();

    /*
     * Envía la notificación push a los
     * dispositivos registrados.
     */
    const pushResult =
      await sendPushToEmails({
        emails:
          recipientEmails,

        title,

        body:
          notificationBody,

        url:
          absoluteUrl,
      });

    /*
     * Crea una notificación interna para
     * cada destinatario.
     *
     * El ID es estable para evitar
     * duplicados si se repite la llamada.
     */
    const batch =
      adminDB.batch();

    recipientEmails.forEach(
      (recipientEmail) => {
        const notificationReference =
          adminDB
            .collection(
              "notifications",
            )
            .doc(
              buildNotificationDocumentId(
                lotId,
                recipientEmail,
              ),
            );

        batch.set(
          notificationReference,
          {
            userEmail:
              recipientEmail,

            tipo:
              "inspection_nonconformity_finalized",

            mensaje:
              notificationBody,

            scopeKey,
            lotId,

            inspectionType:
              cleanString(
                scope.sourceType,
              ) === "proceso"
                ? "proceso"
                : "entrada",

            projectId:
              cleanString(
                scope.projectId,
              ),

            projectName:
              cleanString(
                scope.projectName,
              ),

            wiCode:
              cleanString(
                scope.wiCode,
              ),

            wiTitle:
              cleanString(
                scope.wiTitle,
              ),

            processComponentId:
              cleanString(
                scope
                  .processComponentId,
              ),

            processComponentTitle:
              cleanString(
                scope
                  .processComponentTitle,
              ),

            lotName,
            sampleQuantity,
            rejectedSampleCount,

            inspectorUid:
              decoded.uid,

            inspectorEmail:
              normalizeEmail(
                decoded.email,
              ),

            inspectorName,

            url:
              relativeUrl,

            createdAt:
              FieldValue
                .serverTimestamp(),

            leido: false,
          },
          {
            merge: true,
          },
        );
      },
    );

    batch.set(
      lotReference,
      {
        notifications: {
          finalizedSent:
            true,

          finalizedSentAt:
            FieldValue
              .serverTimestamp(),

          recipients:
            recipientEmails,
        },

        updatedAt:
          FieldValue
            .serverTimestamp(),
      },
      {
        merge: true,
      },
    );

    await batch.commit();

    return NextResponse.json({
      ok: true,

      alreadyNotified:
        false,

      recipientEmails,

      qualityManagerCount:
        qualityManagerEmails.length,

      notificationBody,

      ...pushResult,
    });
  } catch (error) {
    console.error(
      "[nonconformity finalized notification]",
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