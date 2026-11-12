# Accesos de Bioana para iPhone

El widget mediano de la pantalla de inicio abre Place Order, Record, Crear carrito (B1) e Inspecciones dentro de la app iOS. La app carga la plataforma existente y conserva su propia sesión web. Si se requiere iniciar sesión, la plataforma retoma el destino solicitado.

## Instalar para la prueba

1. En macOS, instala Xcode 15 o posterior y XcodeGen. En este directorio, ejecuta `xcodegen generate`.
2. Abre `Bioana.xcodeproj`. En el target **Bioana**, configura `BIOANA_BASE_URL` con el origen HTTPS del entorno que contiene los cambios web de esta rama. Usa solo el dominio, sin una ruta.
3. Selecciona el mismo equipo de firma en ambos targets y configura identificadores propios si los propuestos ya están ocupados. Ejecuta el target Bioana en un iPhone con iOS 17 o posterior.
4. Añade **Accesos de Bioana** desde la galería de widgets de la pantalla de inicio.

Prueba cada acceso con la app cerrada y con la app abierta. Comprueba que el carrito abre en B1, que el escáner QR solicita permiso de cámara en un iPhone físico y que el inicio de sesión devuelve al destino original. Usa el mismo entorno de Bioana para verificar que se mantienen los permisos de cada cuenta.

El cronómetro podrá incorporarse a la extensión con una acción de App Intents que registre el inicio o fin contra el backend, y con ActivityKit para mostrar la sesión en la pantalla bloqueada. La validación de estos accesos se puede hacer antes de configurar el proyecto del cronómetro.
