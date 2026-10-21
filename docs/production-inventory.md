# Production e inventario

- Cargar BOM desde un proyecto DMR: registrar código, nombre, unidad y materiales de ensambles/subensambles, sin cantidades.
- Los artículos nuevos del BOM se crean en B1 y B2 sin existencias; los códigos existentes se reutilizan.
- Configurar cantidades y extra por scrap en cada receta de WI.
- Generar la lista PDO envía una solicitud al almacén seleccionado.
- Asignar almacenistas B1/B2 en Operational → Usuarios para recibir notificaciones y confirmar retiros.
- Inventario → Solicitudes: elegir ubicación/lote y confirmar retiro; los vales se generan con el movimiento.
- Inventario → MTS: completar unidades del catálogo Box, consultar lotes, marcar proyecto de apartado y descargar los QR.
- Un lote apartado solo puede retirarse para su proyecto. Un lote libre sigue disponible.

## Publicación

Los cambios en producción se integran mediante pull request a main y se comprueba el estado de Vercel antes de confirmar el despliegue.

## PDO y solicitudes parciales

Dentro de cada WI y almacén, `production_pdos` conserva el número de PDO, cantidad total, información del formato FRM.017.04F y una copia de la receta vigente al crearla. El número no se repite en la misma WI y almacén. Las recetas posteriores no modifican PDO existentes.

El formato oficial DOCX puede importarse para revisar sus datos antes de guardar. Se extraen campos de la tabla; no se almacena el archivo ni se interpretan firmas como aprobaciones digitales. La P.O. del formato y el identificador de PDO son campos distintos.

Las corridas diarias crean solicitudes en `production_orders` con `pdoId`, unidades y cantidades calculadas (incluido scrap). El acumulado no puede superar la cantidad requerida. La primera solicitud fija un lote por componente para toda la PDO; para usar otro lote se crea otra PDO. Se permite cambiar de ubicación habilitada dentro del mismo lote y almacén.

La capacidad usa exclusivamente los componentes del almacén seleccionado, por lote y ubicación habilitada, sin sumar distintos lotes. Excluye vencidos, material apartado para otro proyecto y solicitudes de producción pendientes. El cálculo usa el mismo redondeo que los retiros y muestra el material limitante. La selección predeterminada usa la mayor capacidad individual de cada componente. La disponibilidad es una consulta, no un movimiento de inventario.

Al crear una solicitud, una transacción comprueba la disponibilidad, el total de PDO y los lotes fijos. Actualiza una versión de reserva en los componentes para serializar solicitudes concurrentes de distintas PDO. Las solicitudes pendientes se consideran comprometidas en los cálculos de producción, sin descontar físicamente el inventario. Otros movimientos de inventario pueden cambiar las existencias, por lo que al confirmar se vuelven a validar.

Almacén solo confirma los lotes y cantidades de la solicitud. Los vales guardan `pdoId`, `productionRequestId` y `productionUnits`; la confirmación y el estado de la solicitud se actualizan en la misma transacción. Una solicitud pendiente puede cancelarla su creador, el creador de la PDO o el almacenista. Se liberan sus cantidades, conservando los lotes fijos y el historial. Los retiros confirmados no se cancelan por esta acción.

Los indicadores distinguen cantidad requerida, solicitada, material retirado para unidades y cantidad de salida real. El material retirado no significa automáticamente producto terminado. Las solicitudes anteriores se conservan agrupadas por número, sin inventar un total o migrarlas a las nuevas PDO.

Validación: `node tests/production-pdo.cjs` cubre capacidad por lote, scrap, exclusiones, veinte solicitudes parciales, límite total, recetas y lotes fijos, cancelación, reintentos, permisos, confirmación y trazabilidad de vales.
