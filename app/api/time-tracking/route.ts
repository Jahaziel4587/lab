import { NextRequest } from "next/server";
import { adminDB } from "@/lib/firebaseAdmin";
import { canOperate } from "@/lib/operacional/catalog";
import { identify } from "@/lib/operacional/server";
import { getDisplayNameForUid } from "@/lib/pushNotifications";
import { scheduleSession } from "@/lib/time-tracking/schedule-session";
import { active, sessions } from "@/lib/time-tracking/server";
import { currentMonth, REMINDER_INTERVAL, monthBounds, manualTimeRange } from "@/lib/time-tracking/shared";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await identify(req);
  if (!user) return Response.json({ error: "Inicia sesión." }, { status: 401 });
  const month = req.nextUrl.searchParams.get("month") || currentMonth();
  let bounds: number[];
  try { bounds = monthBounds(month); } catch { return Response.json({ error: "Mes inválido." }, { status: 400 }); }
  const all = req.nextUrl.searchParams.get("all") === "true";
  if (all && !canOperate(user.email)) return Response.json({ error: "Sin acceso a reportes de Operacional." }, { status: 403 });
  // Single range filter avoids requiring a composite Firestore index.
  const query = all ? sessions : sessions.where("uid", "==", user.uid);
  const [snap, running] = await Promise.all([query.get(), active.doc(user.uid).get()]);
  const now = Date.now();
  const months = new Set([currentMonth(), month]);
  for (const doc of snap.docs) {
    const session = doc.data();
    let cursor = new Date(session.start - 6 * 3600000);
    const last = new Date((session.end ?? now) - 6 * 3600000).toISOString().slice(0, 7);
    while (cursor.toISOString().slice(0, 7) <= last) {
      months.add(cursor.toISOString().slice(0, 7));
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }
  }
  const rows = snap.docs.map(d => ({ ...d.data(), id: d.id })).filter((s: any) => s.start < bounds[1] && (s.end ?? now) > bounds[0]);
  let remindersReady = !running.exists;
  try { if (running.exists) remindersReady = await scheduleSession(user.uid); }
  catch (error) { console.error("Schedule timer reminders", error); }
  return Response.json({ sessions: rows, active: running.data() || null, now, all, months: [...months].sort().reverse(), schedulerActive: remindersReady });
}

export async function POST(req: NextRequest) {
  const user = await identify(req);
  if (!user?.email) return Response.json({ error: "Inicia sesión." }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Solicitud inválida." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "Solicitud inválida." }, { status: 400 });
  const { action, sessionId } = body;
  const title = String(body.title || "").trim().slice(0, 200);
  if (!["start", "stop", "title", "manual"].includes(action)) return Response.json({ error: "Acción inválida." }, { status: 400 });
  if (["stop", "title"].includes(action) && (typeof sessionId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(sessionId))) return Response.json({ error: "Sesión inválida." }, { status: 400 });
  const name = await getDisplayNameForUid(user.uid, user.email);
  if (action === "manual") {
    let range: { start: number; end: number };
    try { range = manualTimeRange(body.start, body.end, Date.now()); }
    catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Rango inválido." }, { status: 400 }); }
    if (typeof body.requestId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.requestId)) return Response.json({ error: "Identificador de registro inválido." }, { status: 400 });
    const ref = sessions.doc(`manual_${body.requestId}`);
    try {
      await adminDB.runTransaction(async tx => {
        const existing = (await tx.get(ref)).data();
        if (existing) {
          if (existing.uid !== user.uid || existing.source !== "manual" || existing.start !== range.start || existing.end !== range.end || existing.title !== title) throw new Error("El identificador corresponde a otro registro.");
          return;
        }
        tx.create(ref, { uid: user.uid, name, email: user.email, title, ...range, source: "manual", createdAt: Date.now() });
      });
      return Response.json({ ok: true });
    } catch (error) {
      console.error("Manual time session", error);
      return Response.json({ error: "No se pudo registrar la sesión. Actualiza e inténtalo de nuevo." }, { status: 409 });
    }
  }
  const newSession = sessions.doc();
  const runningRef = active.doc(user.uid);
  try {
    await adminDB.runTransaction(async tx => {
      const running = (await tx.get(runningRef)).data();
      const now = Date.now();
      if (action === "start") {
        if (running) return;
        const session = { uid: user.uid, name, email: user.email, title, start: now, end: null, source: "timer", createdAt: now };
        tx.create(newSession, session);
        tx.set(runningRef, { ...session, id: newSession.id, nextReminder: now + REMINDER_INTERVAL, reminderInterval: REMINDER_INTERVAL, url: new URL("/", req.url).toString() });
        return;
      }
      const ref = sessions.doc(sessionId);
      const session = (await tx.get(ref)).data();
      if (!session || session.uid !== user.uid) throw new Error("Sesión no disponible.");
      if (action === "title") {
        tx.update(ref, { title });
        if (running?.id === sessionId) tx.update(runningRef, { title });
        return;
      }
      // A retried stop cannot accidentally stop a newer session.
      if (session.end !== null) return;
      if (running?.id !== sessionId) throw new Error("Actualiza el cronómetro.");
      tx.update(ref, { end: now, title });
      tx.delete(runningRef);
    });
    let warning: string | undefined;
    if (action === "start") {
      try { await scheduleSession(user.uid); }
      catch (error) {
        console.error("Schedule timer reminders", error);
        warning = "Tu tiempo se está registrando, pero no se pudo programar el recordatorio. Recarga para reintentarlo.";
      }
    }
    return Response.json({ ok: true, warning });
  } catch (error) {
    console.error("Time tracking", error);
    return Response.json({ error: "No se pudo guardar. Actualiza e inténtalo de nuevo." }, { status: 409 });
  }
}
