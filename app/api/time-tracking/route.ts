import { NextRequest } from "next/server";
import { adminDB } from "@/lib/firebaseAdmin";
import { identify } from "@/lib/operacional/server";
import { getDisplayNameForUid } from "@/lib/pushNotifications";
import { active, sessions, remind } from "@/lib/time-tracking/server";
import { currentMonth, HOUR, monthBounds } from "@/lib/time-tracking/shared";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await identify(req);
  if (!user) return Response.json({ error: "Inicia sesión." }, { status: 401 });
  const month = req.nextUrl.searchParams.get("month") || currentMonth();
  let bounds: number[];
  try { bounds = monthBounds(month); } catch { return Response.json({ error: "Mes inválido." }, { status: 400 }); }
  const all = req.nextUrl.searchParams.get("all") === "true" && user.admin === true;
  // Single range filter avoids requiring a composite Firestore index.
  const query = all ? sessions : sessions.where("uid", "==", user.uid);
  const [snap, running] = await Promise.all([query.get(), active.doc(user.uid).get()]);
  const now = Date.now();
  const rows = snap.docs.map(d => ({ ...d.data(), id: d.id })).filter((s: any) => s.start < bounds[1] && (s.end ?? now) > bounds[0]);
  await remind(user.uid).catch(error => console.error("Timer reminder", error));
  const heartbeat = await adminDB.collection("project_time_scheduler").doc(process.env.VERCEL_ENV === "preview" ? "preview" : "production").get();
  return Response.json({ sessions: rows, active: running.data() || null, now, all, schedulerActive: now - (heartbeat.data()?.lastRun || 0) < 180000 });
}

export async function POST(req: NextRequest) {
  const user = await identify(req);
  if (!user?.email) return Response.json({ error: "Inicia sesión." }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Solicitud inválida." }, { status: 400 }); }
  const { action, sessionId } = body;
  const title = String(body.title || "").trim().slice(0, 200);
  if (!["start", "stop", "title"].includes(action)) return Response.json({ error: "Acción inválida." }, { status: 400 });
  if (action !== "start" && (typeof sessionId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(sessionId))) return Response.json({ error: "Sesión inválida." }, { status: 400 });
  const name = await getDisplayNameForUid(user.uid, user.email);
  const newSession = sessions.doc();
  const runningRef = active.doc(user.uid);
  try {
    await adminDB.runTransaction(async tx => {
      const running = (await tx.get(runningRef)).data();
      const now = Date.now();
      if (action === "start") {
        if (running) return;
        const session = { uid: user.uid, name, email: user.email, title, start: now, end: null };
        tx.create(newSession, session);
        tx.set(runningRef, { ...session, id: newSession.id, nextReminder: now + HOUR, url: new URL("/", req.url).toString() });
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
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Time tracking", error);
    return Response.json({ error: "No se pudo guardar. Actualiza e inténtalo de nuevo." }, { status: 409 });
  }
}
