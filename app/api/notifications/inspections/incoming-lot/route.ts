import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDB } from "@/lib/firebaseAdmin";
import { getDisplayNameForUid, sendPushToEmails } from "@/lib/pushNotifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown) { return String(value || "").trim(); }
function email(value: unknown) { return clean(value).toLowerCase(); }
function origin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!configured) return request.nextUrl.origin;
  return configured.startsWith("http") ? configured : `https://${configured}`;
}
function buildUrl(scope: FirebaseFirestore.DocumentData, lotId: string) {
  const query = new URLSearchParams();
  if (scope.sourceType === "entrada_mts") query.set("origen", "mts");
  else if (scope.projectId) query.set("origen", "proyectos");
  if (scope.projectId) query.set("proyecto", clean(scope.projectId));
  if (scope.wiCode) query.set("wi", clean(scope.wiCode));
  query.set("loteEntrada", lotId);
  if (scope.sourceType === "proceso_proyecto") query.set("componente", clean(scope.componentId));
  return `/inspecciones/${scope.sourceType === "proceso_proyecto" ? "proceso" : "entrada"}?${query.toString()}`;
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(authorization.slice(7));
    const body = await request.json();
    const action = clean(body?.action);
    const scopeKey = clean(body?.scopeKey);
    const lotId = clean(body?.lotId);
    const reportId = clean(body?.reportId);
    const messageId = clean(body?.messageId);
    const inspectionMethod = clean(body?.inspectionMethod);
    if (!scopeKey || !lotId || !["anomaly_created", "message", "decision", "threshold_exceeded", "lot_finalized"].includes(action)) {
      return NextResponse.json({ ok: false, error: "Falta información de la notificación." }, { status: 400 });
    }

    const scopeReference = adminDB.collection("inspection_incoming_lots").doc(scopeKey);
    const lotReference = scopeReference.collection("lots").doc(lotId);
    const [scopeSnapshot, lotSnapshot] = await Promise.all([scopeReference.get(), lotReference.get()]);
    if (!scopeSnapshot.exists || !lotSnapshot.exists) {
      return NextResponse.json({ ok: false, error: "El lote no existe." }, { status: 404 });
    }
    const scope = scopeSnapshot.data() || {};
    const lot = lotSnapshot.data() || {};
    const senderEmail = email(decoded.email);
    const pmEmail = email(lot.responsiblePmEmail);
    const senderName = await getDisplayNameForUid(decoded.uid, decoded.email);
    const relativeUrl = buildUrl(scope, lotId);
    const absoluteUrl = new URL(relativeUrl, origin(request)).toString();
    let recipients: string[] = [];
    const inspectionLabel = scope.sourceType === "proceso_proyecto" ? "proceso" : "entrada";
    let title = `Inspección de ${inspectionLabel}`;
    let notificationBody = "";
    let type = "inspection_incoming_lot";
    let reportReference: FirebaseFirestore.DocumentReference | null = null;
    let report: FirebaseFirestore.DocumentData = {};

    if (!["threshold_exceeded", "lot_finalized"].includes(action)) {
      if (!reportId) return NextResponse.json({ ok: false, error: "Falta el reporte." }, { status: 400 });
      reportReference = lotReference.collection("reports").doc(reportId);
      const reportSnapshot = await reportReference.get();
      if (!reportSnapshot.exists) return NextResponse.json({ ok: false, error: "El reporte no existe." }, { status: 404 });
      report = reportSnapshot.data() || {};
    }

    if (action === "anomaly_created") {
      if (report.kind !== "anomaly" || clean(report.createdByUid) !== decoded.uid) return NextResponse.json({ ok: false, error: "No puedes enviar esta notificación." }, { status: 403 });
      if (report.notifications?.createdSent === true) return NextResponse.json({ ok: true, alreadyNotified: true });
      recipients = [pmEmail];
      title = `Nueva anormalidad en inspección de ${inspectionLabel}`;
      notificationBody = `${senderName} reportó una anormalidad en el lote ${clean(lot.lotName)} de ${clean(scope.componentTitle) || clean(scope.wiTitle)}.`;
      type = "inspection_incoming_anomaly_created";
    }

    if (action === "message") {
      if (!messageId || !reportReference) return NextResponse.json({ ok: false, error: "Falta el mensaje." }, { status: 400 });
      const messageReference = reportReference.collection("messages").doc(messageId);
      const messageSnapshot = await messageReference.get();
      const message = messageSnapshot.data() || {};
      if (!messageSnapshot.exists || clean(message.createdByUid) !== decoded.uid) return NextResponse.json({ ok: false, error: "No puedes notificar este mensaje." }, { status: 403 });
      recipients = clean(report.createdByUid) === decoded.uid
        ? [pmEmail]
        : [email(report.createdByEmail)];
      title = "Nuevo mensaje en una anormalidad";
      notificationBody = `${senderName}: ${clean(message.text).slice(0, 140)}`;
      type = "inspection_incoming_anomaly_message";
    }

    if (action === "decision") {
      if (clean(report.decidedByUid) !== decoded.uid || !["pass", "fail"].includes(clean(report.decision))) return NextResponse.json({ ok: false, error: "No puedes notificar esta decisión." }, { status: 403 });
      if (report.notifications?.decisionSent === true) return NextResponse.json({ ok: true, alreadyNotified: true });
      recipients = [email(report.createdByEmail)];
      title = report.decision === "pass" ? "Anormalidad aceptada" : "Anormalidad rechazada";
      notificationBody = `${senderName} decidió que “${clean(report.title)}” ${report.decision === "pass" ? "pasa" : "no pasa"}.`;
      type = "inspection_incoming_anomaly_decision";
    }

    if (action === "threshold_exceeded") {
      const methodPlan = Array.isArray(lot.methodPlans) ? lot.methodPlans.find((plan: FirebaseFirestore.DocumentData) => clean(plan.method) === inspectionMethod) : null;
      const allowedQuantity = Number(methodPlan?.allowedRejectedQuantity ?? lot.allowedRejectedQuantity ?? 0);
      if (lot.inspectionResult !== "will_fail" || (!methodPlan?.perShift && Number(lot.confirmedUniqueRejectedQuantity || 0) <= allowedQuantity)) return NextResponse.json({ ok: false, error: "El lote todavía no excede el límite confirmado." }, { status: 409 });
      if (lot.failureNotificationSent === true) return NextResponse.json({ ok: true, alreadyNotified: true });
      const qmSnapshot = await adminDB.collection("users").where("isQualityManager", "==", true).get();
      recipients = [pmEmail, ...qmSnapshot.docs.map((entry) => email(entry.data().email))];
      title = "Lote fuera del límite de aceptación";
      const methodName = inspectionMethod === "documentary" ? "documental" : inspectionMethod === "dimensional" ? "dimensional" : inspectionMethod === "functional" ? "funcional" : "visual";
      notificationBody = methodPlan?.perShift ? `El lote ${clean(lot.lotName)} no pasó una inspección por turno del método ${methodName} por un rechazo por SPEC.` : `El lote ${clean(lot.lotName)} tiene ${Number(lot.confirmedUniqueRejectedQuantity || 0)} piezas rechazadas confirmadas en inspección ${methodName}; el máximo permitido para ese método es ${allowedQuantity}. El lote no pasará la inspección.`;
      type = "inspection_incoming_lot_failed";
    }

    if (action === "lot_finalized") {
      if (lot.status !== "finalized" || clean(lot.finalizedByUid) !== decoded.uid || !Number.isInteger(Number(lot.finalRejectedPieces))) {
        return NextResponse.json({ ok: false, error: "El lote todavía no tiene un cierre válido." }, { status: 409 });
      }
      if (lot.finalRejectionNotificationSent === true) return NextResponse.json({ ok: true, alreadyNotified: true });
      const qmSnapshot = await adminDB.collection("users").where("isQualityManager", "==", true).get();
      recipients = [pmEmail, ...qmSnapshot.docs.map((entry) => email(entry.data().email))];
      title = "Inspección de lote finalizada";
      notificationBody = `El lote ${clean(lot.lotName)} finalizó con ${Number(lot.finalRejectedPieces)} piezas que no pasaron la inspección y no estarán disponibles para producción.`;
      type = "inspection_incoming_lot_finalized";
    }

    recipients = Array.from(new Set(recipients.filter((recipient) => recipient && recipient !== senderEmail)));
    await Promise.all([
      recipients.length > 0 ? sendPushToEmails({ emails: recipients, title, body: notificationBody, url: absoluteUrl }) : Promise.resolve(),
      ...recipients.map((recipient) => adminDB.collection("notifications").add({
        userEmail: recipient,
        tipo: type,
        mensaje: notificationBody,
        scopeKey,
        lotId,
        reportId: reportId || null,
        url: relativeUrl,
        createdAt: FieldValue.serverTimestamp(),
        leido: false,
      })),
    ]);

    if (action === "anomaly_created" && reportReference) await reportReference.set({ notifications: { ...(report.notifications || {}), createdSent: true, createdSentAt: FieldValue.serverTimestamp() } }, { merge: true });
    if (action === "decision" && reportReference) await reportReference.set({ notifications: { ...(report.notifications || {}), decisionSent: true, decisionSentAt: FieldValue.serverTimestamp() } }, { merge: true });
    if (action === "threshold_exceeded") await lotReference.set({ failureNotificationSent: true, failureNotificationSentAt: FieldValue.serverTimestamp(), failureConfirmedByUid: decoded.uid, failureConfirmedByEmail: senderEmail, failureConfirmedByName: senderName }, { merge: true });
    if (action === "lot_finalized") await lotReference.set({ finalRejectionNotificationSent: true, finalRejectionNotificationSentAt: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ ok: true, notified: recipients.length });
  } catch (error) {
    console.error("[incoming lot notification]", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "No fue posible enviar la notificación." }, { status: 500 });
  }
}
