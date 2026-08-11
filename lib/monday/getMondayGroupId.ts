type PedidoGroupInput = {
  titulo?: string;
};

function requireEnvironmentVariable(
  name: string,
  value: string | undefined,
) {
  if (!value) {
    throw new Error(`Falta ${name}`);
  }

  return value;
}

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getMondayGroupId(input: PedidoGroupInput) {
  const titulo = normalize(String(input.titulo || ""));

  if (titulo.includes("umkr") || titulo.includes("bml")) {
    return requireEnvironmentVariable(
      "MONDAY_GROUP_FILAMENTO_ID",
      process.env.MONDAY_GROUP_FILAMENTO_ID,
    );
  }

  if (titulo.includes("fl3b") || titulo.includes("fl2b")) {
    return requireEnvironmentVariable(
      "MONDAY_GROUP_RESINA_ID",
      process.env.MONDAY_GROUP_RESINA_ID,
    );
  }

  if (titulo.includes("cnc")) {
    return requireEnvironmentVariable(
      "MONDAY_GROUP_CNC_ID",
      process.env.MONDAY_GROUP_CNC_ID,
    );
  }

  if (titulo.includes("laser")) {
    return requireEnvironmentVariable(
      "MONDAY_GROUP_LASER_ID",
      process.env.MONDAY_GROUP_LASER_ID,
    );
  }

  if (titulo.includes("need")) {
    return requireEnvironmentVariable(
      "MONDAY_GROUP_NECESIDAD_ID",
      process.env.MONDAY_GROUP_NECESIDAD_ID,
    );
  }

  if (titulo.includes("fxt")) {
    throw new Error(
      "Los pedidos FXT no pertenecen al tablero de servicios básicos",
    );
  }

  throw new Error(
    `No se pudo identificar el grupo de Monday desde el título: ${input.titulo}`,
  );
}