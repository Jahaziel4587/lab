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
