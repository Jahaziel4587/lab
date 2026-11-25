import { active, remind } from "./server";
import { REMINDER_INTERVAL } from "./shared";

export async function inspectReminderSession(uid: string, sessionId: string): Promise<number | null> {
  "use step";
  const data = (await active.doc(uid).get()).data();
  if (!data || data.id !== sessionId) return null;
  return data.reminderInterval === REMINDER_INTERVAL ? data.nextReminder : data.start + REMINDER_INTERVAL;
}

export async function deliverSessionReminder(uid: string, sessionId: string): Promise<number | null> {
  "use step";
  await remind(uid, sessionId);
  const ref = active.doc(uid);
  return await ref.firestore.runTransaction(async tx => {
    const data = (await tx.get(ref)).data();
    if (!data || data.id !== sessionId) return null;
    tx.update(ref, { lastWorkflowCheck: Date.now() });
    return Math.max(data.nextReminder, data.leaseUntil || 0);
  });
}
