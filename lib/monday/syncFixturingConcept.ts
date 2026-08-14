import { mondayRequest } from "./client";

const SUBITEM_COLUMNS = {
  owner: "person",
  status: "status",
} as const;

const MAIN_COLUMNS = {
  status: "status",
} as const;

type MondayItem = {
  id: string;
  name: string;
};

type CreateSubitemResponse = {
  create_subitem: MondayItem;
};

type ChangeColumnValuesResponse = {
  change_multiple_column_values: {
    id: string;
  };
};

async function updateGeneralSubitemStatus({
  subitemId,
  completed,
}: {
  subitemId: string;
  completed: boolean;
}) {
  const mutation = `
    mutation UpdateGeneralSubitemStatus(
      $boardId: ID!
      $itemId: ID!
      $columnValues: JSON!
    ) {
      change_multiple_column_values(
        board_id: $boardId
        item_id: $itemId
        column_values: $columnValues
      ) {
        id
      }
    }
  `;

  const result =
    await mondayRequest<ChangeColumnValuesResponse>(
      mutation,
      {
        boardId: "18426074693",
        itemId: subitemId,
        columnValues: JSON.stringify({
          [SUBITEM_COLUMNS.status]: {
            label: completed
              ? "Listo"
              : "En curso",
          },
        }),
      }
    );

  return result
    .change_multiple_column_values;
}

export async function createConceptApprovalSubitem({
  phaseItemId,
  versionLabel,
  mondayUserId,
}: {
  phaseItemId: string;
  versionLabel: string;
  mondayUserId: string;
}) {
  const columnValues: Record<
    string,
    unknown
  > = {};

  if (mondayUserId) {
    columnValues[SUBITEM_COLUMNS.owner] = {
      personsAndTeams: [
        {
          id: Number(mondayUserId),
          kind: "person",
        },
      ],
    };
  }

  const mutation = `
    mutation CreateConceptApprovalSubitem(
      $parentItemId: ID!
      $itemName: String!
      $columnValues: JSON!
    ) {
      create_subitem(
        parent_item_id: $parentItemId
        item_name: $itemName
        column_values: $columnValues
      ) {
        id
        name
      }
    }
  `;

  const result =
    await mondayRequest<CreateSubitemResponse>(
      mutation,
      {
        parentItemId: phaseItemId,
        itemName:
          `Firmar versión ${versionLabel}`,
        columnValues:
          JSON.stringify(columnValues),
      }
    );

  return result.create_subitem;
}

export async function completeConceptApprovalSubitem(
  subitemId: string
) {
  /*
   * Los subelementos del tablero utilizan
   * la etiqueta española "Listo".
   */
  const mutation = `
    mutation CompleteConceptApprovalSubitem(
      $boardId: ID!
      $itemId: ID!
      $columnValues: JSON!
    ) {
      change_multiple_column_values(
        board_id: $boardId
        item_id: $itemId
        column_values: $columnValues
      ) {
        id
      }
    }
  `;

  const result =
    await mondayRequest<ChangeColumnValuesResponse>(
      mutation,
      {
        boardId: "18426074693",
        itemId: subitemId,
        columnValues: JSON.stringify({
          [SUBITEM_COLUMNS.status]: {
            label: "Listo",
          },
        }),
      }
    );

  return result
    .change_multiple_column_values;
}

export async function updateConceptPhaseStatus({
  boardId,
  phaseItemId,
  generalSubitemIds,
  approved,
}: {
  boardId: string;
  phaseItemId: string;
  generalSubitemIds: string[];
  approved: boolean;
}) {
  const phaseLabel = approved
    ? "Done"
    : "Working on it";

  const mutation = `
    mutation UpdateConceptPhaseStatus(
      $boardId: ID!
      $itemId: ID!
      $columnValues: JSON!
    ) {
      change_multiple_column_values(
        board_id: $boardId
        item_id: $itemId
        column_values: $columnValues
      ) {
        id
      }
    }
  `;

  const phaseResult =
    await mondayRequest<ChangeColumnValuesResponse>(
      mutation,
      {
        boardId,
        itemId: phaseItemId,
        columnValues: JSON.stringify({
          [MAIN_COLUMNS.status]: {
            label: phaseLabel,
          },
        }),
      }
    );

  /*
   * Solo actualizamos las subactividades generales
   * guardadas al crear la estructura. La subactividad
   * dinámica de firma no se incluye aquí.
   */
  await Promise.all(
    generalSubitemIds.map((subitemId) =>
      updateGeneralSubitemStatus({
        subitemId,
        completed: approved,
      })
    )
  );

  return phaseResult
    .change_multiple_column_values;
}