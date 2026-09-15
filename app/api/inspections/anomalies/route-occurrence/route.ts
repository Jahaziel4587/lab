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

function clean(value: unknown) {
  return String(value || "").trim();
}

function email(value: unknown) {
  return clean(value).toLowerCase();
}

function normalized(value: unknown) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-MX");
}

function buildUrl(
  scope: FirebaseFirestore.DocumentData,
  anomalyId: string,
) {
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

  const type =
    scope.sourceType === "proceso"
      ? "proceso"
      : "entrada";

  return `/inspecciones/${type}?${query}`;
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
    const sourceAnomalyId =
      clean(body?.sourceAnomalyId);
    const occurrenceId =
      clean(body?.occurrenceId);
    const mode = clean(body?.mode);
    const existingAnomalyId =
      clean(body?.existingAnomalyId);
    const title = clean(body?.title);
    const decision = clean(body?.decision);
    const comment = clean(body?.comment);

    if (
      !scopeKey ||
      !sourceAnomalyId ||
      !occurrenceId ||
      !["new", "existing"].includes(mode)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta información para reclasificar el reporte.",
        },
        { status: 400 },
      );
    }

    if (
      mode === "new" &&
      (
        !title ||
        !["pass", "fail"].includes(decision)
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Asigna un título y selecciona Pass o Fail.",
        },
        { status: 400 },
      );
    }

    if (
      mode === "existing" &&
      !existingAnomalyId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Selecciona una anormalidad existente.",
        },
        { status: 400 },
      );
    }

    const scopeReference =
      adminDB.collection("inspection_anomalies").doc(scopeKey);
    const sourceReference =
      scopeReference.collection("anomalies").doc(sourceAnomalyId);
    const occurrenceReference =
      sourceReference.collection("occurrences").doc(occurrenceId);

    const [
      scopeSnapshot,
      sourceSnapshot,
      occurrenceSnapshot,
    ] = await Promise.all([
      scopeReference.get(),
      sourceReference.get(),
      occurrenceReference.get(),
    ]);

    if (
      !scopeSnapshot.exists ||
      !sourceSnapshot.exists ||
      !occurrenceSnapshot.exists
    ) {
      return NextResponse.json(
        { ok: false, error: "El reporte no existe." },
        { status: 404 },
      );
    }

    const scope = scopeSnapshot.data() || {};
    const source = sourceSnapshot.data() || {};
    const occurrence = occurrenceSnapshot.data() || {};

    if (
      email(decoded.email) !==
      email(source.responsiblePmEmail)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Solo el PM responsable puede reclasificar este reporte.",
        },
        { status: 403 },
      );
    }

    const isInitialReport =
      occurrence.followUp !== true;

    /*
     * En el reporte inicial, crear una nueva
     * anormalidad equivale a decidir la actual.
     * Esta ruta solamente lo traslada cuando
     * se relaciona con una ya existente.
     */
    if (
      isInitialReport &&
      mode === "new"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Usa Tomar decisión para asignar el título y la decisión.",
        },
        { status: 409 },
      );
    }

    if (occurrence.redirectedToAnomalyId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Este reporte ya fue relacionado con otra anormalidad.",
        },
        { status: 409 },
      );
    }

    let targetReference:
      FirebaseFirestore.DocumentReference;
    let targetTitle = title;
    let targetDecision = decision;
    let targetResponsiblePmUid =
      clean(source.responsiblePmUid);
    let targetResponsiblePmEmail =
      email(source.responsiblePmEmail);
    let targetResponsiblePmName =
      clean(source.responsiblePmName);

    if (mode === "existing") {
      targetReference =
        scopeReference
          .collection("anomalies")
          .doc(existingAnomalyId);

      if (targetReference.id === sourceAnomalyId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Selecciona una anormalidad diferente.",
          },
          { status: 409 },
        );
      }

      const targetSnapshot =
        await targetReference.get();

      if (!targetSnapshot.exists) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "La anormalidad seleccionada ya no existe.",
          },
          { status: 404 },
        );
      }

      const target = targetSnapshot.data() || {};
      targetTitle =
        clean(target.title) ||
        "Anormalidad relacionada";
      targetDecision = clean(target.decision);
      targetResponsiblePmUid =
        clean(target.responsiblePmUid);
      targetResponsiblePmEmail =
        email(target.responsiblePmEmail);
      targetResponsiblePmName =
        clean(target.responsiblePmName);
    } else {
      const duplicate =
        await scopeReference
          .collection("anomalies")
          .where(
            "normalizedTitle",
            "==",
            normalized(title),
          )
          .limit(1)
          .get();

      if (!duplicate.empty) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Ya existe una anormalidad con ese título.",
          },
          { status: 409 },
        );
      }

      targetReference =
        scopeReference
          .collection("anomalies")
          .doc();
    }

    const targetOccurrenceReference =
      targetReference
        .collection("occurrences")
        .doc();

    const decidedByName =
      await getDisplayNameForUid(
        decoded.uid,
        decoded.email,
      );

    const batch = adminDB.batch();

    if (mode === "new") {
      batch.set(targetReference, {
        title,
        normalizedTitle:
          normalized(title),
        status: "resolved",
        decision,
        decisionComment: comment,
        responsiblePmUid:
          targetResponsiblePmUid,
        responsiblePmEmail:
          targetResponsiblePmEmail,
        responsiblePmName:
          targetResponsiblePmName,
        createdByUid:
          clean(occurrence.createdByUid),
        createdByEmail:
          email(occurrence.createdByEmail),
        createdAt:
          FieldValue.serverTimestamp(),
        updatedAt:
          FieldValue.serverTimestamp(),
        decidedByUid: decoded.uid,
        decidedByEmail:
          email(decoded.email),
        decidedByName,
        decidedAt:
          FieldValue.serverTimestamp(),
        createdFromAnomalyId:
          sourceAnomalyId,
        createdFromOccurrenceId:
          occurrenceId,
      });
    } else {
      batch.update(targetReference, {
        updatedAt:
          FieldValue.serverTimestamp(),
      });
    }

    batch.set(
      targetOccurrenceReference,
      {
        ...occurrence,
        anomalyId:
          targetReference.id,
        responsiblePmUid:
          targetResponsiblePmUid,
        responsiblePmEmail:
          targetResponsiblePmEmail,
        responsiblePmName:
          targetResponsiblePmName,
        relatedFromAnomalyId:
          sourceAnomalyId,
        relatedFromOccurrenceId:
          occurrenceId,
        relatedByUid:
          decoded.uid,
        relatedByEmail:
          email(decoded.email),
        relatedAt:
          FieldValue.serverTimestamp(),
      },
    );

    batch.update(occurrenceReference, {
      redirectedToAnomalyId:
        targetReference.id,
      redirectedToOccurrenceId:
        targetOccurrenceReference.id,
      redirectedByUid:
        decoded.uid,
      redirectedByEmail:
        email(decoded.email),
      redirectedAt:
        FieldValue.serverTimestamp(),
    });

    if (
      isInitialReport &&
      mode === "existing"
    ) {
      /*
       * El documento vacío deja de aparecer
       * en el catálogo. La copia completa vive
       * en la anormalidad de destino.
       */
      batch.delete(
        sourceReference,
      );
    } else {
      batch.set(
        sourceReference
          .collection("messages")
          .doc(),
        {
          type: "routing",
          text:
            `El reporte adicional fue relacionado con "${targetTitle}".`,
          targetAnomalyId:
            targetReference.id,
          createdByUid:
            decoded.uid,
          createdByEmail:
            email(decoded.email),
          createdByName:
            decidedByName,
          createdAt:
            FieldValue.serverTimestamp(),
        },
      );
    }

    batch.set(
      targetReference
        .collection("messages")
        .doc(),
      {
        type:
          mode === "new"
            ? "decision"
            : "routing",
        text:
          mode === "new"
            ? `Decisión inicial: ${decision === "pass" ? "Pass" : "Fail"}` +
              (comment ? `. ${comment}` : "")
            : `Se relacionó un reporte desde "${clean(source.title) || "otro reporte"}".`,
        sourceAnomalyId,
        createdByUid:
          decoded.uid,
        createdByEmail:
          email(decoded.email),
        createdByName:
          decidedByName,
        createdAt:
          FieldValue.serverTimestamp(),
      },
    );

    await batch.commit();

    const reporterEmail =
      email(occurrence.createdByEmail);
    const component =
      clean(scope.processComponentTitle) ||
      clean(scope.wiTitle) ||
      "el componente";
    const lot =
      clean(occurrence.lot);
    const resultText =
      targetDecision === "pass"
        ? "pasa"
        : targetDecision === "fail"
          ? "no pasa"
          : "queda pendiente de decisión";
    const notificationBody =
      `Tu reporte de la anormalidad en ${component}` +
      `${lot ? `, lote ${lot}` : ""} ` +
      `se relacionó con "${targetTitle}" y ${resultText}.`;
    const relativeUrl =
      buildUrl(
        scope,
        targetReference.id,
      );

    if (reporterEmail) {
      await Promise.all([
        sendPushToEmails({
          emails: [reporterEmail],
          title:
            mode === "new"
              ? "Tu reporte es una nueva anormalidad"
              : "Tu reporte fue relacionado",
          body: notificationBody,
          url: new URL(
            relativeUrl,
            notificationOrigin(request),
          ).toString(),
        }),
        adminDB
          .collection("notifications")
          .add({
            userEmail:
              reporterEmail,
            tipo:
              mode === "new"
                ? "inspection_anomaly_created_from_occurrence"
                : "inspection_anomaly_related",
            mensaje:
              notificationBody,
            scopeKey,
            anomalyId:
              targetReference.id,
            occurrenceId:
              targetOccurrenceReference.id,
            url:
              relativeUrl,
            createdAt:
              FieldValue.serverTimestamp(),
            read: false,
          }),
      ]);
    }

    return NextResponse.json({
      ok: true,
      targetAnomalyId:
        targetReference.id,
    });
  } catch (error) {
    console.error(
      "Error reclasificando reporte:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible reclasificar el reporte.",
      },
      { status: 500 },
    );
  }
}
