import { mondayRequest } from "./client";
import { findMondayUserByEmail } from "./findMondayUserByEmail";
import { getMondayGroupId } from "./getMondayGroupId";

type CreatePedidoItemInput = {
  pedidoId: string;
  titulo: string;
  proyecto: string;
   material: string;
  correoSolicitante: string;
  fechaEntrega?: string | null;
  urlProtolab: string;
};

type CreateItemResponse = {
  create_item: {
    id: string;
    name: string;
  };
};

function requireEnvironmentVariable(
  name: string,
  value: string | undefined,
) {
  if (!value) {
    throw new Error(`Falta la variable ${name} en .env.local`);
  }

  return value;
}

export async function createPedidoItem(
  input: CreatePedidoItemInput,
) {
  const boardId = requireEnvironmentVariable(
    "MONDAY_SERVICIOS_BOARD_ID",
    process.env.MONDAY_SERVICIOS_BOARD_ID,
  );

  /*
   * El grupo se determina únicamente con la abreviatura
   * contenida en el título:
   *
   * UMKR/BML → Filamento
   * FL3B/FL2B → Resina
   * CNC       → CNC
   * Láser     → Láser
   * Need      → Necesidad
   */
  const groupId = getMondayGroupId({
    titulo: input.titulo,
  });

  /*
   * Busca la cuenta de Monday correspondiente al correo
   * de la persona que realizó el pedido.
   */
  const mondayUser = input.correoSolicitante
    ? await findMondayUserByEmail(input.correoSolicitante)
    : null;

  const columnValues: Record<string, unknown> = {};

  const deadlineColumn =
    process.env.MONDAY_COLUMN_DEADLINE_ID;

  const stakeholderColumn =
    process.env.MONDAY_COLUMN_STAKEHOLDER_ID;

const materialColumn =
  process.env.MONDAY_COLUMN_MATERIAL_ID;

  const projectColumn =
    process.env.MONDAY_COLUMN_PROJECT_ID;

  const protolabLinkColumn =
    process.env.MONDAY_COLUMN_PROTOLAB_LINK_ID;

  /*
   * Solamente llenamos Stakeholder.
   * Owner queda vacío para asignarlo manualmente en Monday.
   */
  if (mondayUser && stakeholderColumn) {
    columnValues[stakeholderColumn] = {
      personsAndTeams: [
        {
          id: Number(mondayUser.id),
          kind: "person",
        },
      ],
    };
  }

  if (deadlineColumn && input.fechaEntrega) {
    columnValues[deadlineColumn] = {
      date: input.fechaEntrega,
    };
  }

  if (projectColumn) {
    columnValues[projectColumn] =
      input.proyecto || "Sin proyecto";
  }

  if (protolabLinkColumn) {
    columnValues[protolabLinkColumn] = {
      url: input.urlProtolab,
      text: input.pedidoId,
    };
  }

if (materialColumn) {
  columnValues[materialColumn] =
    input.material || "No especificado";
}

  /*
   * No enviamos Status para que Monday utilice
   * el valor predeterminado configurado en el tablero.
   */
  const mutation = `
    mutation CreatePedidoItem(
      $boardId: ID!
      $groupId: String!
      $itemName: String!
      $columnValues: JSON!
    ) {
      create_item(
        board_id: $boardId
        group_id: $groupId
        item_name: $itemName
        column_values: $columnValues
      ) {
        id
        name
      }
    }
  `;

  const result = await mondayRequest<CreateItemResponse>(
    mutation,
    {
      boardId,
      groupId,
      itemName: input.titulo,
      columnValues: JSON.stringify(columnValues),
    },
  );

  return {
    item: result.create_item,
    groupId,
    mondayUser,
  };
}