import type { CatalogListItem } from "../components/CatalogList";

export const mockProjects: CatalogListItem[] = [
  {
    id: "dmr-007",
    title: "DMR.007 LumeNXT",
    description: "Proyecto de prueba",
  },
  {
    id: "dmr-001",
    title: "DMR.001 Ocumetics",
    description: "Proyecto de prueba",
  },
  {
    id: "dmr-002",
    title: "DMR.002 Labella",
    description: "Proyecto de prueba",
  },
];

export const mockMtsComponents: CatalogListItem[] = [
  {
    id: "wi-mts-001",
    title: "WI.001.00.101 Shared Component",
    description: "Componente MTS de prueba",
  },
  {
    id: "wi-mts-002",
    title: "WI.001.00.102 Shared Housing",
    description: "Componente MTS de prueba",
  },
];

export const mockIncomingByProject: Record<
  string,
  CatalogListItem[]
> = {
  "dmr-007": [
    {
      id: "wi-007-00312",
      title: "WI.007.00.312 Top Battery Housing",
      description: "Componente de entrada",
    },
  ],

  "dmr-001": [
    {
      id: "wi-001-00101",
      title: "WI.001.00.101 Main Housing",
      description: "Componente de entrada",
    },
  ],

  "dmr-002": [],
};

export const mockProcessByProject: Record<
  string,
  CatalogListItem[]
> = {
  "dmr-007": [
    {
      id: "wi-007-07",
      title: "WI.007.07 Rtrabajo",
      description: "Work instruction de proceso",
    },
  ],

  "dmr-001": [
    {
      id: "wi-001-05",
      title: "WI.001.05 Assembly Process",
      description: "Work instruction de proceso",
    },
  ],

  "dmr-002": [],
};

export const mockProcessComponentsByWi: Record<
  string,
  CatalogListItem[]
> = {
  "wi-007-07": [
    {
      id: "process-component-001",
      title: "Battery housing assembly",
      description: "Componente de proceso registrado manualmente",
    },
  ],

  "wi-001-05": [],

  "wi-mts-001": [],
};