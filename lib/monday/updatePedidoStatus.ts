import { mondayRequest } from "./client";

type MondayColumn = {
  id: string;
  type: string;
};

type MondaySubitem = {
  id: string;
  board: {
    id: string;
    columns: MondayColumn[];
  };
};

type GetPedidoItemResponse = {
  items: Array<{
    id: string;
    board: {
      id: string;
    };
    subitems: MondaySubitem[];
  }>;
};

type ChangeColumnValueResponse = {
  change_multiple_column_values: {
    id: string;
  };
};

function requireEnvironmentVariable(
  name: string,
  value: string | undefined
) {
  if (!value) {
    throw new Error(
      `Falta la variable ${name} en .env.local`
    );
  }

  return value;
}

async function changeStatusToListo(
  boardId: string,
  itemId: string,
  statusColumnId: string
) {
  const mutation = `
    mutation ChangePedidoStatus(
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

  await mondayRequest<ChangeColumnValueResponse>(
    mutation,
    {
      boardId,
      itemId,
      columnValues: JSON.stringify({
        [statusColumnId]: {
          label: "Done",
        },
      }),
    }
  );
}

export async function updatePedidoAndSubitemsToListo(
  mondayItemId: string
) {
  const mainStatusColumnId =
    requireEnvironmentVariable(
      "MONDAY_COLUMN_STATUS_ID",
      process.env.MONDAY_COLUMN_STATUS_ID
    );

  /*
   * Consultamos la actividad principal, su tablero
   * y todos sus subelementos.
   *
   * También pedimos las columnas del tablero de
   * subelementos para encontrar automáticamente
   * su columna de tipo "status".
   */
  const query = `
    query GetPedidoAndSubitems($itemIds: [ID!]!) {
      items(ids: $itemIds) {
        id
        board {
          id
        }
        subitems {
          id
          board {
            id
            columns {
              id
              type
            }
          }
        }
      }
    }
  `;

  const result =
    await mondayRequest<GetPedidoItemResponse>(
      query,
      {
        itemIds: [mondayItemId],
      }
    );

  const mainItem = result.items[0];

  if (!mainItem) {
    throw new Error(
      "La actividad vinculada ya no existe en Monday"
    );
  }

  /*
   * Primero actualizamos la actividad principal.
   */
  await changeStatusToListo(
    mainItem.board.id,
    mainItem.id,
    mainStatusColumnId
  );

  /*
   * Después actualizamos todos los subelementos.
   *
   * Buscamos la columna por su tipo para no depender
   * de que su ID sea igual al de la actividad principal.
   */
  const subitemResults = await Promise.allSettled(
    mainItem.subitems.map(async (subitem) => {
      const statusColumn =
        subitem.board.columns.find(
          (column) => column.type === "status"
        );

      if (!statusColumn) {
        throw new Error(
          `El subelemento ${subitem.id} no tiene una columna de estado`
        );
      }

      await changeStatusToListo(
        subitem.board.id,
        subitem.id,
        statusColumn.id
      );

      return subitem.id;
    })
  );

  const failedSubitems = subitemResults
    .map((result, index) => ({
      result,
      subitemId:
        mainItem.subitems[index]?.id || "",
    }))
    .filter(
      (
        entry
      ): entry is {
        result: PromiseRejectedResult;
        subitemId: string;
      } => entry.result.status === "rejected"
    );

  if (failedSubitems.length > 0) {
    const details = failedSubitems
      .map(({ result, subitemId }) => {
        const reason =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);

        return `${subitemId}: ${reason}`;
      })
      .join("; ");

    throw new Error(
      `La actividad principal se marcó como Listo, pero fallaron ${failedSubitems.length} subelementos: ${details}`
    );
  }

  return {
    mondayItemId: mainItem.id,
    updatedMainItem: true,
    updatedSubitems:
      mainItem.subitems.map(
        (subitem) => subitem.id
      ),
  };
}