# Cronómetro del proyecto

La página principal permite iniciar una sesión en un toque y detenerla desde cualquier dispositivo con la misma cuenta. El título es opcional y editable. El reporte CSV incluye totales por usuario y sesiones del mes seleccionado. El reporte CSV está en Operacional → Horas del proyecto y solo las cuentas autorizadas para Operacional pueden consultar a todos los usuarios. El inicio muestra únicamente el registro de la cuenta actual. Los cortes mensuales usan horario de Monterrey. El proyecto queda provisionalmente identificado como “Proyecto · registro de horas”.

## Programar los recordatorios

Configura un programador de servidor para hacer GET cada minuto a:

    https://DOMINIO_DEL_PREVIEW/api/time-tracking/reminders

Debe enviar el encabezado Authorization con el valor Bearer seguido del CRON_SECRET configurado en las variables de Preview de Vercel. Si el preview tiene protección de despliegue, el programador también necesita el encabezado x-vercel-protection-bypass con el secreto de automatización de Vercel. Usa la URL estable de la rama para que el programador siga apuntando a la versión actual.

Los recordatorios de producción se ejecutan con .github/workflows/project-time-reminders.yml. Cada trabajo hace cinco revisiones separadas por un minuto. GitHub inicia trabajos cada cinco minutos y puede retrasarlos, por lo que los avisos pueden llegar después del minuto exacto. El workflow se inicia al publicarse en main y también puede ejecutarse manualmente desde Actions.

La autenticación usa un token OIDC de corta duración emitido por GitHub y validado contra sus claves oficiales. Solo se admite el workflow indicado del repositorio 1033226499 en main para producción. Esto no necesita copiar credenciales Firebase o configurar secretos compartidos en GitHub. El endpoint sigue aceptando CRON_SECRET para programadores externos. La interfaz muestra si hubo una revisión del programador en los últimos tres minutos. Con la página abierta también revisa cada diez segundos.

Los recordatorios se reclaman con una transacción y un arrendamiento de dos minutos. Si el programador estuvo interrumpido, se envía un recordatorio con los minutos acumulados y se continúa en el siguiente minuto de la sesión. La entrega push depende del permiso y la conectividad de cada dispositivo. No se puede garantizar entrega exactamente una vez si el proceso se interrumpe después de enviar a FCM y antes de confirmar en Firestore.

Las colecciones de Preview y producción están separadas. Las credenciales administrativas y permisos de Firestore se mantienen en el servidor. El preview necesita las variables Firebase y CRON_SECRET del entorno correspondiente. Las reglas de Firestore desplegadas deben impedir escrituras del cliente a project_time_* y project_time_scheduler, ya que las operaciones autorizadas se realizan por las API del servidor.

El intervalo de avisos es temporalmente de un minuto para la prueba solicitada. REMINDER_INTERVAL en shared.ts controla el intervalo sin alterar la duración real de las sesiones.
