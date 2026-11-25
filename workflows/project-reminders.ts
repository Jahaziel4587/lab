import { sleep } from "workflow";
import { start } from "workflow/api";
import { inspectReminderSession, deliverSessionReminder } from "@/lib/time-tracking/reminder-steps";

export async function projectReminders(uid: string, sessionId: string, batch = 0) {
  "use workflow";
  let due = await inspectReminderSession(uid, sessionId);
  // Renew the workflow periodically so an unattended session cannot exhaust its event history.
  for (let index = 0; index < 240 && due !== null; index++) {
    await sleep(new Date(Math.max(due, Date.now() + 1000)));
    due = await deliverSessionReminder(uid, sessionId);
  }
  if (due !== null) {
    await start(projectReminders, [uid, sessionId, batch + 1], {
      experimental_hook: { token: `project-reminders:${sessionId}:${batch + 1}` },
    });
  }
}
