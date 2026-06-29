export type Props = {
  pedido: any;
  pedidoId: string;
  isAdmin: boolean;
  user: any;
};

export type UploadedFile = {
  name: string;
  url: string;
};

export type FixtureVersion = {
  id: string;
  versionLabel: string;
  descripcion?: string;
  especificacionesExtra?: string[];
  archivos?: UploadedFile[];
  status?: "pendiente" | "aprobado" | "rechazado";
  createdAt?: any;
  creadoPor?: string;
  firmas?: Record<string, any>;
};

export type ApprovalRole = "pm" | "disenador" | "encargado";

export type Decision = "aprobado" | "rechazado";

export type UserPermissionData = {
  email?: string;
  nombre?: string;
  apellido?: string;
  displayName?: string;
  pmProjects?: string[];
  isDesigner?: boolean;
  processOwnerOf?: string[];
};

export type LinkedPedido = {
  id: string;
  titulo?: string;
  servicio?: string;
  subtotal?: number;
  status?: string;
   fixtureRelacionadoId?: string;
  fixtureRelacionadoFase?: "concepto" | "prueba" | "beta";
  fixtureRelacionadoVersion?: string;
};

export type TabKey =
  | "resumen"
  | "concepto"
  | "prueba"
  | "confirmacion"
  | "specDraft"
  | "beta"
  | "specFinal";