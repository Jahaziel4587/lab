import { start } from "workflow/api";
import { HookConflictError } from "workflow/errors";
import { projectReminders } from "@/workflows/project-reminders";
import { active } from "./server";

export async function scheduleSession(uid: string) {
  const ref = active.doc(uid);
  const session = (await ref.get()).data();
  if (!session) return false;
  if (session.workflowRunId) return true;
  let runId: string;
  try {
    const run = await start(projectReminders, [uid, session.id], {
      experimental_hook: { token: `project-reminders:${session.id}:0` },
    });
    runId = run.runId;
  } catch (error) {
    if (!HookConflictError.is(error) || !error.conflictingRunId) throw error;
    runId = error.conflictingRunId;
  }
  await ref.firestore.runTransaction(async tx => {
    const current = (await tx.get(ref)).data();
    if (current?.id === session.id) tx.update(ref, { workflowRunId: runId, workflowScheduledAt: Date.now() });
  });
  return true;
}
