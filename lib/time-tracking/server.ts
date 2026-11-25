import { randomUUID } from "node:crypto";
import { adminDB } from "@/lib/firebaseAdmin";
import { sendPushToEmails } from "@/lib/pushNotifications";
import { HOUR } from "./shared";

// Preview sessions cannot collide with the production timer when sharing Firebase.
export const scope = process.env.VERCEL_ENV === "preview" ? "preview" : "production";
export const sessions = adminDB.collection(`project_time_${scope}_sessions`);
export const active = adminDB.collection(`project_time_${scope}_active`);

export async function remind(uid: string) {
  const ref = active.doc(uid);
  const lease = randomUUID();
  const claim = await adminDB.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const now = Date.now();
    if (!data || now < data.nextReminder || (data.leaseUntil || 0) > now) return null;
    tx.update(ref, { lease, leaseUntil: now + 120000 });
    return data;
  });
  if (!claim) return;
  try {
    const hours = Math.floor((Date.now() - claim.start) / HOUR);
    await sendPushToEmails({ emails: [claim.email], title: `${hours} hora${hours === 1 ? "" : "s"} de trabajo registrada${hours === 1 ? "" : "s"}`,
      body: "¿Sigues trabajando en el proyecto? Si terminaste, abre Bioana y detén el cronómetro.", url: claim.url });
    await adminDB.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (snap.data()?.lease === lease) tx.update(ref, { nextReminder: claim.start + (hours + 1) * HOUR, leaseUntil: 0 });
    });
  } catch (error) {
    await adminDB.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (snap.data()?.lease === lease) tx.update(ref, { leaseUntil: 0 });
    });
    throw error;
  }
}
