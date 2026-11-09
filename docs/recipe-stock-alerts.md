# Avisos de inventario por recetas fijas

La revisión diaria está configurada en `vercel.json` para las 12:00 UTC.
En Vercel, agregar una variable de entorno **CRON_SECRET** en **Production**,
con un valor aleatorio secreto, y desplegar nuevamente si se agregó después
del despliegue. El endpoint rechaza peticiones que no llevan ese secreto como
token Bearer. Sin la variable, los retiros funcionan pero no se envían avisos.

La proyección usa los próximos 14 días a partir de mañana (los movimientos
de hoy ya están reflejados en las existencias). Suma los retiros programados
según la fecha de inicio y la frecuencia de cada receta activa. Solo usa
existencias utilizables, sin apartado y vigentes al día del consumo previsto.
Es una estimación de cantidades totales; al retirar se valida el lote real.

El aviso va a los almacenistas asignados a B1 o B2, en la campana y por push
si tienen un dispositivo activo. Cada sede mantiene su propio estado de aviso.
El mismo riesgo no dispara avisos diarios: vuelve a notificarse si primero
desaparece y luego se detecta otro faltante.
