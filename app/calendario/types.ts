export type Pedido = {
  id: string;

  // Un pedido normal usa pedidoId = id.
  // Una ejecución usa un id visual compuesto, pero conserva pedidoId.
  pedidoId: string;
  ejecucionId?: string;
  esEjecucion?: boolean;

  titulo: string;
  proyecto?: string;
  fechaEntregaReal?: string;
  fechaLimite?: string;
  costo?: string;
  status?: string;
  nombreCosto?: string;
  correoUsuario?: string;
  nombreUsuario?: string;
  subtotalBaseMXN?: number;
};

export type Usuario = {
  email: string;
  nombre: string;
  uid?: string;
};

export type ProyectoStats = {
  total: number;
  listos: number;
  ultima: number;
};