import { adminDB } from "@/lib/firebaseAdmin";

function email(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

/** Operations owns this role. Resolve it on each event so reassignment takes effect immediately. */
export async function getQualityManagerEmails(): Promise<string[]> {
  const snapshot = await adminDB.collection("users").where("isQualityManager", "==", true).get();
  return [...new Set(snapshot.docs.map(doc => {
    const user = doc.data();
    return email(user.email) || email(user.correo);
  }).filter(Boolean))];
}

/** Quality receives every inspection event, including events they trigger themselves. */
export async function inspectionNotificationRecipients(primary: string[], sender?: string): Promise<string[]> {
  const quality = await getQualityManagerEmails();
  const actor = email(sender);
  return [...new Set([
    ...primary.map(email).filter(address => address && address !== actor),
    ...quality,
  ])];
}
