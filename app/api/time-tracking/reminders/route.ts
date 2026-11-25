import { timingSafeEqual } from "node:crypto";
import { adminDB } from "@/lib/firebaseAdmin";
import { active, remind, scope } from "@/lib/time-tracking/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const received = Buffer.from(req.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret || ""}`);
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) return Response.json({ error: "No autorizado." }, { status: 401 });
  await adminDB.collection("project_time_scheduler").doc(scope).set({ lastRun: Date.now() });
  const due = await active.where("nextReminder", "<=", Date.now()).limit(200).get();
  const results = await Promise.allSettled(due.docs.map(doc => remind(doc.id)));
  const failed = results.filter(result => result.status === "rejected").length;
  return Response.json({ checked: due.size, failed }, { status: failed ? 500 : 200 });
}
