import { randomUUID } from "node:crypto";
import { adminDB } from "@/lib/firebaseAdmin";
import { sendPushToEmails } from "@/lib/pushNotifications";
import { REMINDER_INTERVAL } from "./shared";

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
    if (!data) return null;
    const nextReminder = data.reminderInterval === REMINDER_INTERVAL ? data.nextReminder : data.start + REMINDER_INTERVAL;
    if (now < nextReminder || (data.leaseUntil || 0) > now) return null;
    tx.update(ref, { lease, leaseUntil: now + 120000 });
    return data;
  });
  if (!claim) return;
  try {
    const minutes = Math.floor((Date.now() - claim.start) / REMINDER_INTERVAL);
    await sendPushToEmails({ emails: [claim.email], title: `Recordatorio de prueba · ${minutes} min de trabajo`,
      body: "¿Sigues trabajando en el proyecto? Si terminaste, abre Bioana y detén el cronómetro.", url: claim.url });
    await adminDB.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (snap.data()?.lease === lease) tx.update(ref, { nextReminder: claim.start + (minutes + 1) * REMINDER_INTERVAL, reminderInterval: REMINDER_INTERVAL, leaseUntil: 0 });
    });
  } catch (error) {
    await adminDB.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (snap.data()?.lease === lease) tx.update(ref, { leaseUntil: 0 });
    });
    throw error;
  }
}
