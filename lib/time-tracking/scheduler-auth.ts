import { timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

const githubKeys = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
export async function authorizeScheduler(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const actual = Buffer.from(authorization);
    const expected = Buffer.from(`Bearer ${secret}`);
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) return true;
  }
  if (process.env.VERCEL_ENV === "preview" || !authorization.startsWith("Bearer ")) return false;
  try {
    const { payload } = await jwtVerify(authorization.slice(7), githubKeys, {
      issuer: "https://token.actions.githubusercontent.com",
      audience: "bioana-project-time-reminders",
      algorithms: ["RS256"],
      maxTokenAge: "10m",
      requiredClaims: ["exp", "iat", "repository_id", "ref", "workflow_ref", "event_name"],
    });
    return payload.repository_id === "1033226499" &&
      payload.repository === "Jahaziel4587/lab" &&
      payload.ref === "refs/heads/main" &&
      payload.workflow_ref === "Jahaziel4587/lab/.github/workflows/project-time-reminders.yml@refs/heads/main" &&
      ["schedule", "workflow_dispatch", "push"].includes(String(payload.event_name));
  } catch {
    return false;
  }
}
