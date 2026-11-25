# Cronómetro del proyecto

La página principal inicia una sesión en un toque y permite detenerla desde cualquier dispositivo con la misma cuenta. Los títulos son opcionales y editables. El inicio muestra el historial personal. Operacional → Horas del proyecto ofrece totales por usuario y CSV con el detalle del mes. Usa los mismos permisos existentes de Operacional y cortes mensuales de Monterrey.

## Recordatorios con Bioana cerrada

Al iniciar la sesión, la API registra en Vercel Workflow una tarea duradera identificada por la sesión. La tarea espera hasta el siguiente aviso, verifica que esa sesión siga activa y llama al mismo sendPushToEmails que pedidos e inventario. La tarea se reanuda en el servidor aunque el navegador esté cerrado. Al detener o reemplazar la sesión, el siguiente paso termina sin enviar.

REMINDER_INTERVAL sigue configurado temporalmente en un minuto para la prueba solicitada. No cambia la duración real de las sesiones. Cada cuatro horas de recordatorios, la tarea inicia una continuación para mantener acotado su historial de ejecución. Los pasos de envío conservan la reclamación transaccional para evitar envíos concurrentes. Un cierre inesperado después de enviar a FCM y antes de confirmar en Firestore puede causar un aviso duplicado.

El inicio de tareas usa un token determinista por sesión para evitar programaciones duplicadas. Si falla la programación después de guardar el inicio, el tiempo permanece registrado y la API devuelve un aviso explícito. Una consulta posterior reintenta la programación. Las sesiones previas a esta versión se incorporan cuando el usuario vuelve a abrir Bioana. La página no envía recordatorios como efecto secundario de consultar el historial.

La configuración withWorkflow genera los endpoints internos administrados por Vercel. El despliegue debe incluir las variables Firebase existentes para que sus pasos accedan al registro y FCM. Las sesiones de preview y producción permanecen separadas. Las reglas de Firestore deben impedir escrituras desde el cliente a project_time_* porque se accede mediante las API autenticadas del servidor.

El endpoint protegido por CRON_SECRET /api/time-tracking/reminders queda disponible para recuperación manual. El programador de GitHub Actions se retiró porque su frecuencia no resultó confiable para este uso.
