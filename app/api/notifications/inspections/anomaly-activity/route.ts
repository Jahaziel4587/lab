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

function clean(value: unknown) {
  return String(value || "").trim();
}

function email(value: unknown) {
  return clean(value).toLowerCase();
}

function buildUrl(
  scope: FirebaseFirestore.DocumentData,
  anomalyId: string,
) {
  const process =
    clean(scope.sourceType) === "proceso";
  const query = new URLSearchParams();

  if (scope.sourceType === "entrada_mts") {
    query.set("origen", "mts");
  } else if (scope.projectId) {
    query.set("origen", "proyectos");
  }

  if (scope.projectId) {
    query.set("proyecto", clean(scope.projectId));
  }
  if (scope.wiCode) {
    query.set("wi", clean(scope.wiCode));
  }
  if (scope.processComponentId) {
    query.set(
      "componente",
      clean(scope.processComponentId),
    );
  }

  query.set("hallazgo", "anormalidad");
  query.set("anomalia", anomalyId);

  return `/inspecciones/${process ? "proceso" : "entrada"}?${query}`;
}

export async function POST(
  request: NextRequest,
) {
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
        authorization.slice(7),
      );

    const body = await request.json();
    const scopeKey = clean(body?.scopeKey);
    const anomalyId = clean(body?.anomalyId);
    const activityType = clean(body?.activityType);
    const activityId = clean(body?.activityId);

    if (
      !scopeKey ||
      !anomalyId ||
      !["message", "occurrence"].includes(activityType)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta información de la actividad.",
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
        { ok: false, error: "La anormalidad no existe." },
        { status: 404 },
      );
    }

    const scope = scopeSnapshot.data() || {};
    const anomaly = anomalySnapshot.data() || {};
    const senderEmail = email(decoded.email);
    const responsibleEmail =
      email(anomaly.responsiblePmEmail);

    let targetEmail = "";
    let title = "";
    let notificationBody = "";

    if (activityType === "occurrence") {
      const occurrenceSnapshot =
        await anomalyReference
          .collection("occurrences")
          .doc(activityId)
          .get();

      if (
        !occurrenceSnapshot.exists ||
        clean(
          occurrenceSnapshot.data()?.createdByUid,
        ) !== decoded.uid
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "El reporte no existe o no te pertenece.",
          },
          { status: 403 },
        );
      }

      targetEmail =
        email(
          occurrenceSnapshot.data()
            ?.responsiblePmEmail,
        ) || responsibleEmail;

      title = "Nuevo reporte de anormalidad";
      notificationBody =
        `${await getDisplayNameForUid(decoded.uid, decoded.email)} ` +
        `reportó otra ocurrencia en ${clean(scope.processComponentTitle) || clean(scope.wiTitle) || "el componente"}.`;
    } else {
      const messageSnapshot =
        await anomalyReference
          .collection("messages")
          .doc(activityId)
          .get();

      if (
        !messageSnapshot.exists ||
        clean(
          messageSnapshot.data()?.createdByUid,
        ) !== decoded.uid
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "El mensaje no existe o no te pertenece.",
          },
          { status: 403 },
        );
      }

      if (
        senderEmail &&
        senderEmail === responsibleEmail
      ) {
        const latestReporter =
          await anomalyReference
            .collection("occurrences")
            .orderBy("createdAt", "desc")
            .limit(1)
            .get();

        targetEmail =
          email(
            latestReporter.docs[0]
              ?.data()?.createdByEmail,
          );
      } else {
        targetEmail = responsibleEmail;
      }

      title = "Nuevo mensaje en una anormalidad";
      notificationBody =
        `${await getDisplayNameForUid(decoded.uid, decoded.email)}: ` +
        clean(messageSnapshot.data()?.text).slice(0, 140);
    }

    if (!targetEmail || targetEmail === senderEmail) {
      return NextResponse.json({
        ok: true,
        notified: false,
      });
    }

    const relativeUrl =
      buildUrl(scope, anomalyId);

    const result = await sendPushToEmails({
      emails: [targetEmail],
      title,
      body: notificationBody,
      url: new URL(
        relativeUrl,
        request.nextUrl.origin,
      ).toString(),
    });

    await adminDB
      .collection("notifications")
      .add({
        userEmail: targetEmail,
        tipo:
          activityType === "occurrence"
            ? "inspection_anomaly_occurrence"
            : "inspection_anomaly_message",
        mensaje: notificationBody,
        scopeKey,
        anomalyId,
        activityId,
        url: relativeUrl,
        createdAt:
          FieldValue.serverTimestamp(),
        read: false,
      });

    return NextResponse.json({
      ok: true,
      notified: true,
      push: result,
    });
  } catch (error) {
    console.error(
      "Error notificando actividad de anormalidad:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible enviar la notificación.",
      },
      { status: 500 },
    );
  }
}
