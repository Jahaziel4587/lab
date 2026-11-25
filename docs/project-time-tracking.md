# Cronómetro del proyecto

La página principal permite iniciar una sesión en un toque y detenerla desde cualquier dispositivo con la misma cuenta. El título es opcional y editable. El reporte CSV incluye totales por usuario y sesiones del mes seleccionado. Solo las cuentas con claim admin pueden consultar a todos los usuarios. Los cortes mensuales usan horario de Monterrey. El proyecto queda provisionalmente identificado como “Proyecto · registro de horas”.

## Programar los recordatorios

Configura un programador de servidor para hacer GET cada minuto a:

    https://DOMINIO_DEL_PREVIEW/api/time-tracking/reminders

Debe enviar el encabezado Authorization con el valor Bearer seguido del CRON_SECRET configurado en las variables de Preview de Vercel. Si el preview tiene protección de despliegue, el programador también necesita el encabezado x-vercel-protection-bypass con el secreto de automatización de Vercel. Usa la URL estable de la rama para que el programador siga apuntando a la versión actual.

No se añadió un cron de Vercel porque esos cron solo corren en producción, y el usuario solicitó probar en preview. El endpoint es compatible con un cron externo o con Vercel Cron al llevarlo a producción en un plan que permita ejecución frecuente. El registro de horas funciona de forma independiente del programador. La interfaz muestra si recibió una ejecución del programador durante los últimos tres minutos. Con la página abierta se revisan también los avisos cada treinta segundos.

Los recordatorios se reclaman con una transacción y un arrendamiento de dos minutos. Si el programador estuvo interrumpido, se envía un recordatorio con las horas acumuladas y se continúa en el siguiente aniversario horario. La entrega push depende del permiso y la conectividad de cada dispositivo. No se puede garantizar entrega exactamente una vez si el proceso se interrumpe después de enviar a FCM y antes de confirmar en Firestore.

Las colecciones de Preview y producción están separadas. Las credenciales administrativas y permisos de Firestore se mantienen en el servidor. El preview necesita las variables Firebase y CRON_SECRET del entorno correspondiente. Las reglas de Firestore desplegadas deben impedir escrituras del cliente a project_time_* y project_time_scheduler, ya que las operaciones autorizadas se realizan por las API del servidor.
