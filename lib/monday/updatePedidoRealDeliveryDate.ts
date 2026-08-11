import { mondayRequest } from "./client";

type ChangeColumnValueResponse = {
  change_column_value: {
    id: string;
  };
};

function requireEnvironmentVariable(
  name: string,
  value: string | undefined,
) {
  if (!value) {
    throw new Error(
      `Falta la variable ${name} en .env.local`,
    );
  }

  return value;
}

export async function updatePedidoRealDeliveryDate(
  itemId: string,
  fechaEntregaReal: string,
) {
  const boardId = requireEnvironmentVariable(
    "MONDAY_SERVICIOS_BOARD_ID",
    process.env.MONDAY_SERVICIOS_BOARD_ID,
  );

  const columnId = requireEnvironmentVariable(
    "MONDAY_COLUMN_REAL_DELIVERY_DATE_ID",
    process.env.MONDAY_COLUMN_REAL_DELIVERY_DATE_ID,
  );

  const mutation = `
    mutation UpdatePedidoRealDeliveryDate(
      $boardId: ID!
      $itemId: ID!
      $columnId: String!
      $value: JSON!
    ) {
      change_column_value(
        board_id: $boardId
        item_id: $itemId
        column_id: $columnId
        value: $value
      ) {
        id
      }
    }
  `;

  /*
   * Si la fecha viene vacía, se limpia también
   * la columna correspondiente en Monday.
   */
  const value = fechaEntregaReal
    ? JSON.stringify({
        date: fechaEntregaReal,
      })
    : JSON.stringify({});

  const result =
    await mondayRequest<ChangeColumnValueResponse>(
      mutation,
      {
        boardId,
        itemId,
        columnId,
        value,
      },
    );

  return result.change_column_value;
}