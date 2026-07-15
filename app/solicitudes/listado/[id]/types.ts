export type QuoteMeta = {
  currency?: "MXN" | "USD";
  exchangeRate?: number;
  ivaDefault?: number;
  status?: "open" | "locked";
  createdAt?: any;
  updatedAt?: any;
};

export type QuoteLine = {
  serviceId?: string;
  serviceName?: string;
  answers?: Record<string, number>;
  selects?: Record<string, string>;
  subtotalMXN?: number;
  createdAt?: any;
};

export type ServiceField = {
  key: string;
  label: string;
  type: string;
  options?: string[];
};

export type ServiceDoc = {
  name: string;
  fields: ServiceField[];
};

export type QuoteDraft = {
  gananciaPct: number;
  cliente?: string;
  atencionA?: string;
  envio?: number;
  notas?: string;
};

export type OrgBranding = {
  companyName?: string;
  addressLine?: string;
  phone?: string;
  email?: string;
};

export type PdfCoords = {
  fecha?: { x: number; y: number };
  folio?: { x: number; y: number };
  cliente?: { x: number; y: number };
  atencion?: { x: number; y: number };
  subtotal?: { x: number; y: number };
  iva?: { x: number; y: number };
  envio?: { x: number; y: number };
  total?: { x: number; y: number };
  itemsArea: {
    x: number;
    yTop: number;
    width: number;
    lineHeight: number;
    yBottom: number;
  };
};

export type PdfTemplateConf = {
  templatePath: string;
  coords: PdfCoords;
};

export type SpecUpdate = {
  id: string;
  version: number;
  descripcion: string;
  createdAt?: any;
  archivos?: { name: string; url: string }[];
};

export type ChatMessage = {
  id: string;
  text: string;
  createdAt?: any;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string;
  isAdmin?: boolean;
  vistoPorUser?: boolean;
  vistoPorAdmin?: boolean;
  notificacionCreada?: boolean;
};

export type EjecucionPedido = {
  id: string;

  numero: number;

  titulo: string;

  tipo: string;

  pedidoId: string;

  fechaSolicitud: any;

  fechaLimite: string;

  fechaEntregaReal: string;

  status: string;

  solicitadoPorUid: string;

  solicitadoPorEmail: string;

  solicitadoPorNombre: string;

  notas?: string;

  createdAt?: any;

  updatedAt?: any;
};