import { adminAuth, adminDB, adminMessaging } from "@/lib/firebaseAdmin";

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function getDisplayNameForUid(uid: string, fallbackEmail?: string | null) {
  try {
    const userDoc = await adminDB.collection("users").doc(uid).get();
    if (userDoc.exists) {
      const data = userDoc.data() as any;
      const nombre = String(data?.nombre || "").trim();
      const apellido = String(data?.apellido || "").trim();
      const full = [nombre, apellido].filter(Boolean).join(" ");
      if (full) return full;
    }
  } catch (error) {
    console.error("[push] No se pudo leer el nombre del usuario:", error);
  }

  return fallbackEmail || "Usuario";
}

async function getActiveTokensForEmails(emails: string[]) {
  const normalized = Array.from(
    new Set(emails.map(normalizeEmail).filter(Boolean)),
  );

  if (normalized.length === 0) return [] as string[];

  const snap = await adminDB
    .collection("push_devices")
    .where("active", "==", true)
    .get();

  const tokens: string[] = [];
  snap.forEach((doc) => {
    const data = doc.data() as any;
    if (
      typeof data.token === "string" &&
      normalized.includes(normalizeEmail(data.email))
    ) {
      tokens.push(data.token);
    }
  });

  return Array.from(new Set(tokens));
}

export async function getAdminEmails() {
  const emails: string[] = [];
  let pageToken: string | undefined;

  do {
    const page = await adminAuth.listUsers(1000, pageToken);
    for (const user of page.users) {
      if (user.customClaims?.admin === true && user.email) {
        emails.push(normalizeEmail(user.email));
      }
    }
    pageToken = page.pageToken;
  } while (pageToken);

  return Array.from(new Set(emails));
}

export async function sendPushToEmails(args: {
  emails: string[];
  title: string;
  body: string;
  url: string;
}) {
  const tokens = await getActiveTokensForEmails(args.emails);
  if (tokens.length === 0) {
    return { attempted: 0, successCount: 0, failureCount: 0 };
  }

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    const response = await adminMessaging.sendEachForMulticast({
      tokens: batch,
      notification: {
        title: args.title,
        body: args.body,
      },
      data: {
        title: args.title,
        body: args.body,
        url: args.url,
      },
      webpush: {
        fcmOptions: {
          link: args.url,
        },
      },
    });

    successCount += response.successCount;
    failureCount += response.failureCount;

    const invalidTokens: string[] = [];
    response.responses.forEach((result, index) => {
      const code = result.error?.code || "";
      if (
        !result.success &&
        (code.includes("registration-token-not-registered") ||
          code.includes("invalid-registration-token"))
      ) {
        invalidTokens.push(batch[index]);
      }
    });

    if (invalidTokens.length > 0) {
      const deviceSnap = await adminDB.collection("push_devices").get();
      const writes = deviceSnap.docs
        .filter((doc) => invalidTokens.includes(String(doc.data()?.token || "")))
        .map((doc) => doc.ref.set({ active: false }, { merge: true }));
      await Promise.all(writes);
    }
  }

  return {
    attempted: tokens.length,
    successCount,
    failureCount,
  };
}
