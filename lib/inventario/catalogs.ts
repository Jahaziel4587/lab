export const WAREHOUSES = [
  { id: "pendiente", name: "Pendiente de inspección", usable: false },
  { id: "aprobado", name: "Material aprobado", usable: true },
  { id: "ssc", name: "Materiales con SSC", usable: true },
  { id: "rechazado", name: "Material rechazado", usable: false },
  { id: "retencion", name: "Retención", usable: false },
  { id: "cuarentena", name: "Cuarentena", usable: false },
  { id: "semiterminado", name: "Producto Semiterminado", usable: true },
  { id: "terminado", name: "Producto Terminado", usable: true },
  { id: "no-conforme", name: "Producto No Conforme", usable: false },
  { id: "limpieza", name: "Limpieza", usable: true },
];
export const EXTERNAL_LOCATIONS = [
  { id: "externo:recepcion", name: "Recepción / proveedor" },
  { id: "externo:produccion", name: "Actividades de operación / producción" },
  { id: "externo:envio", name: "Envío (salida de planta)" },
  { id: "externo:otro", name: "Otro" },
];
export const LOCATIONS = [...WAREHOUSES, ...EXTERNAL_LOCATIONS];
export const TYPES = { "100": "Ensamble", "200": "Subensamble", "300": "Componente", "400": "Materia prima", MTS: "MTS" };
export function locationName(id: string) { return LOCATIONS.find(x => x.id === id)?.name || id; }
