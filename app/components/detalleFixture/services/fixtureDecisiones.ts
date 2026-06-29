import type { Decision } from "../types";

export const buildFixtureFirmaPayload = ({
  decision,
  rejectReason,
  userEmail,
  userDisplayName,
}: {
  decision: Decision;
  rejectReason?: string;
  userEmail?: string;
  userDisplayName: string;
}) => {
  const fecha = new Date().toISOString();

  return {
    decision,
    correo: userEmail || "",
    nombre: userDisplayName,
    fecha,
    approvedByEmail: userEmail || "",
    approvedByName: userDisplayName,
    approvedAt: fecha,
    rejectReason:
      decision === "rechazado" ? String(rejectReason || "").trim() : "",
  };
};