import { mondayRequest } from "./client";

const MAIN_COLUMNS = {
  status: "status",
  deadline: "date4",
  stakeholder: "multiple_person_mm632ab4",
  protolabLink: "link_mm63f8xy",
} as const;

type MondayItem = {
  id: string;
  name: string;
};

type MondayGroup = {
  id: string;
  title: string;
};

type MondayUser = {
  id: string;
  name: string;
  email: string;
};

type CreateGroupResponse = {
  create_group: MondayGroup;
};

type CreateItemResponse = {
  create_item: MondayItem;
};

type CreateSubitemResponse = {
  create_subitem: MondayItem;
};

type FindUsersResponse = {
  users: MondayUser[];
};

export type FixturingPhaseKey =
  | "solicitudFormal"
  | "conceptoDiseno"
  | "pruebaDiseno"
  | "specDraft"
  | "versionBeta"
  | "specFinal";

type CreateFixturingStructureInput = {
  pedidoId: string;
  titulo: string;
  correoSolicitante: string;
  fechaLimite: string | null;
  urlProtolab: string;
};

type PhaseDefinition = {
  key: FixturingPhaseKey;
  name: string;
  status?: "Done" | "Working on it";
  includeDeadline?: boolean;
  subitems: string[];
};

const PHASES: PhaseDefinition[] = [
  {
    key: "solicitudFormal",
    name: "Solicitud Formal",
    status: "Done",
    includeDeadline: true,
    subitems: [],
  },
  {
    key: "conceptoDiseno",
    name: "Concepto de Diseño",
    status: "Working on it",
    subitems: [
      "Entender bien la necesidad",
      "Lluvia de ideas y definir el concepto",
      "Presentar concepto al PM",
      "Registrar versiones en plataforma",
    ],
  },
  {
    key: "pruebaDiseno",
    name: "Prueba de Diseño",
    status: "Working on it",
    subitems: [
      "Diseñar versión PoC",
      "Registrar explicación detallada del diseño",
      "Registrar servicios básicos utilizados",
      "Usar exitosamente el Fixture/Jig en el proceso",
      "Firma y aprobación Diseñador",
      "Firma y aprobación Project Manager",
      "Firma y aprobación Encargado del proceso",
    ],
  },
  {
    key: "specDraft",
    name: "SPEC Draft",
    subitems: [],
  },
  {
    key: "versionBeta",
    name: "Versión Beta",
    status: "Working on it",
    subitems: [
      "Diseñar versión beta",
      "Registrar versiones realizadas",
      "Registrar servicios básicos utilizados",
    ],
  },
  {
    key: "specFinal",
    name: "Hacer SPEC, DWG, WI",
    subitems: [],
  },
];

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

async function findMondayUserByEmail(
  email: string
): Promise<MondayUser | null> {
  const normalizedEmail = email
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const query = `
    query FindMondayUser($emails: [String!]) {
      users(emails: $emails) {
        id
        name
        email
      }
    }
  `;

  const result =
    await mondayRequest<FindUsersResponse>(
      query,
      {
        emails: [normalizedEmail],
      }
    );

  return result.users[0] || null;
}

async function createGroup(
  boardId: string,
  groupName: string
) {
  const mutation = `
    mutation CreateFixturingGroup(
      $boardId: ID!
      $groupName: String!
    ) {
      create_group(
        board_id: $boardId
        group_name: $groupName
      ) {
        id
        title
      }
    }
  `;

  const result =
    await mondayRequest<CreateGroupResponse>(
      mutation,
      {
        boardId,
        groupName,
      }
    );

  return result.create_group;
}

async function createPhaseItem({
  boardId,
  groupId,
  name,
  columnValues,
}: {
  boardId: string;
  groupId: string;
  name: string;
  columnValues: Record<string, unknown>;
}) {
  const mutation = `
    mutation CreateFixturingPhase(
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

  const result =
    await mondayRequest<CreateItemResponse>(
      mutation,
      {
        boardId,
        groupId,
        itemName: name,
        columnValues:
          JSON.stringify(columnValues),
      }
    );

  return result.create_item;
}

async function createGeneralSubitem(
  parentItemId: string,
  name: string
) {
  const mutation = `
    mutation CreateFixturingSubitem(
      $parentItemId: ID!
      $itemName: String!
    ) {
      create_subitem(
        parent_item_id: $parentItemId
        item_name: $itemName
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
        parentItemId,
        itemName: name,
      }
    );

  return result.create_subitem;
}

export async function createFixturingStructure(
  input: CreateFixturingStructureInput
) {
  const boardId =
    requireEnvironmentVariable(
      "MONDAY_FIXTURING_BOARD_ID",
      process.env.MONDAY_FIXTURING_BOARD_ID
    );

  const mondayUser =
    await findMondayUserByEmail(
      input.correoSolicitante
    );

  const group = await createGroup(
    boardId,
    input.titulo
  );

  const phaseItems = {} as Record<
    FixturingPhaseKey,
    {
      itemId: string;
      itemName: string;
      generalSubitems: Array<{
        id: string;
        name: string;
      }>;
    }
  >;

  for (const phase of PHASES) {
    const columnValues:
      Record<string, unknown> = {
        [MAIN_COLUMNS.protolabLink]: {
          url: input.urlProtolab,
          text: input.pedidoId,
        },
      };

    if (phase.status) {
      columnValues[MAIN_COLUMNS.status] = {
        label: phase.status,
      };
    }

    if (
      phase.includeDeadline &&
      input.fechaLimite
    ) {
      columnValues[MAIN_COLUMNS.deadline] = {
        date: input.fechaLimite,
      };
    }

    if (mondayUser) {
      columnValues[MAIN_COLUMNS.stakeholder] = {
        personsAndTeams: [
          {
            id: Number(mondayUser.id),
            kind: "person",
          },
        ],
      };
    }

    const item = await createPhaseItem({
      boardId,
      groupId: group.id,
      name: phase.name,
      columnValues,
    });

    const generalSubitems = [];

    for (const subitemName of phase.subitems) {
      const subitem =
        await createGeneralSubitem(
          item.id,
          subitemName
        );

      generalSubitems.push(subitem);
    }

    phaseItems[phase.key] = {
      itemId: item.id,
      itemName: item.name,
      generalSubitems: generalSubitems.map(
        (subitem) => ({
          id: subitem.id,
          name: subitem.name,
        })
      ),
    };
  }

  return {
    boardId,
    groupId: group.id,
    groupTitle: group.title,
    mondayUser,
    phases: phaseItems,
  };
}