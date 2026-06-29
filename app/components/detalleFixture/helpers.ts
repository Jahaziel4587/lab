export const normalizePermissionValue = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "y")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

export const formatFirebaseDate = (value: any) => {
  return value?.toDate?.() instanceof Date
    ? value.toDate().toLocaleString()
    : "Fecha no disponible";
};

export const buildFixtureOrderUrl = ({
  proyecto,
  fixtureId,
  fixtureFase,
  fixtureVersion,
}: {
  proyecto: string;
  fixtureId: string;
  fixtureFase: "concepto" | "prueba" | "beta";
  fixtureVersion: string;
}) => {
  const params = new URLSearchParams({
    proyecto,
    fixtureRelacionadoId: fixtureId,
    fixtureRelacionadoFase: fixtureFase,
    fixtureRelacionadoVersion: fixtureVersion,
  });

  return `/hacer-pedido/servicios?${params.toString()}`;
};