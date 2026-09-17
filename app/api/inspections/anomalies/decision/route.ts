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

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown) {
  return cleanString(value).toLowerCase();
}

function normalizeTitle(value: unknown) {
  return cleanString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-MX");
}

function buildInspectionUrl(
  scope: FirebaseFirestore.DocumentData,
  anomalyId: string,
) {
  const sourceType = cleanString(scope.sourceType);
  const inspectionType =
    sourceType === "proceso" ? "proceso" : "entrada";
  const query = new URLSearchParams();

  if (sourceType === "entrada_mts") {
    query.set("origen", "mts");
  } else if (scope.projectId) {
    query.set("origen", "proyectos");
  }

  if (scope.projectId) {
    query.set("proyecto", cleanString(scope.projectId));
  }
  if (scope.wiCode) {
    query.set("wi", cleanString(scope.wiCode));
  }
  if (scope.processComponentId) {
    query.set(
      "componente",
      cleanString(scope.processComponentId),
    );
  }

  query.set("hallazgo", "anormalidad");
  query.set("anomalia", anomalyId);

  return `/inspecciones/${inspectionType}?${query.toString()}`;
}

export async function POST(request: NextRequest) {
  try {
    const authorization =
      request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { ok: false, error: "No autorizado." },
        { status: 401 },
      );
    }

    const decoded =
      await adminAuth.verifyIdToken(
        authorization.slice("Bearer ".length),
      );

    const body = await request.json();
    const scopeKey = cleanString(body?.scopeKey);
    const anomalyId = cleanString(body?.anomalyId);
    const title = cleanString(body?.title);
    const normalizedTitle = normalizeTitle(title);
    const decision = cleanString(body?.decision);
    const comment = cleanString(body?.comment);

    if (
      !scopeKey ||
      !anomalyId ||
      !title ||
      !["pass", "fail"].includes(decision)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Completa el título y selecciona Pasó o No pasó.",
        },
        { status: 400 },
      );
    }

    const scopeReference =
      adminDB.collection("inspection_anomalies").doc(scopeKey);
    const anomalyReference =
      scopeReference.collection("anomalies").doc(anomalyId);

    const [scopeSnapshot, anomalySnapshot] =
      await Promise.all([
        scopeReference.get(),
        anomalyReference.get(),
      ]);

    if (!scopeSnapshot.exists || !anomalySnapshot.exists) {
      return NextResponse.json(
        {
          ok: false,
          error: "La anormalidad no existe.",
        },
        { status: 404 },
      );
    }

    const scope = scopeSnapshot.data() || {};
    const anomaly = anomalySnapshot.data() || {};
    const authenticatedEmail =
      normalizeEmail(decoded.email);
    const responsiblePmEmail =
      normalizeEmail(anomaly.responsiblePmEmail);

    if (
      !authenticatedEmail ||
      authenticatedEmail !== responsiblePmEmail
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Solo el PM responsable puede tomar esta decisión.",
        },
        { status: 403 },
      );
    }

    if (anomaly.status === "resolved") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Esta anormalidad ya tiene una decisión final.",
        },
        { status: 409 },
      );
    }

    const duplicateSnapshot =
      await scopeReference
        .collection("anomalies")
        .where("normalizedTitle", "==", normalizedTitle)
        .limit(2)
        .get();

    const duplicate = duplicateSnapshot.docs.some(
      (document) => document.id !== anomalyId,
    );

    if (duplicate) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ya existe una anormalidad con ese título para este componente.",
        },
        { status: 409 },
      );
    }

    const decidedByName =
      await getDisplayNameForUid(
        decoded.uid,
        decoded.email,
      );

    const batch = adminDB.batch();
    batch.update(anomalyReference, {
      title,
      normalizedTitle,
      status: "resolved",
      decision,
      decisionComment: comment,
      decidedByUid: decoded.uid,
      decidedByEmail: authenticatedEmail,
      decidedByName,
      decidedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const messageReference =
      anomalyReference.collection("messages").doc();

    batch.set(messageReference, {
      text:
        `Decisión final: ${decision === "pass" ? "Pasó" : "No pasó"}` +
        (comment ? `. ${comment}` : ""),
      type: "decision",
      createdByUid: decoded.uid,
      createdByEmail: authenticatedEmail,
      createdByName: decidedByName,
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    const reporterEmail =
      normalizeEmail(anomaly.createdByEmail);
    const relativeUrl =
      buildInspectionUrl(scope, anomalyId);

    if (
      reporterEmail &&
      reporterEmail !== authenticatedEmail
    ) {
      const notificationTitle =
        decision === "pass"
          ? "Anormalidad aprobada"
          : "Anormalidad rechazada";
      const notificationBody =
        `${decidedByName} tomó una decisión sobre "${title}".`;

      await Promise.all([
        sendPushToEmails({
          emails: [reporterEmail],
          title: notificationTitle,
          body: notificationBody,
          url: new URL(
            relativeUrl,
            notificationOrigin(request),
          ).toString(),
        }),
        adminDB.collection("notifications").add({
          userEmail: reporterEmail,
          tipo: "inspection_anomaly_decision",
          mensaje: notificationBody,
          scopeKey,
          anomalyId,
          decision,
          url: relativeUrl,
          createdAt: FieldValue.serverTimestamp(),
          read: false,
        }),
      ]);
    }

    return NextResponse.json({
      ok: true,
      title,
      decision,
    });
  } catch (error) {
    console.error(
      "Error guardando decisión de anormalidad:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible guardar la decisión.",
      },
      { status: 500 },
    );
  }
}
