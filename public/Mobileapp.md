## Home.tsx

Este archivo es el componente principal de la pantalla de inicio de una aplicación de reservas de viajes en autobús construida con React Native. Sus funciones son:

- **Búsqueda de viajes:** Permite a los usuarios buscar viajes de autobús por origen, destino, o código de ruta usando un campo de texto. 
- **Visualización de resultados:** Muestra una lista de viajes disponibles según el criterio de búsqueda. Si no hay resultados, informa al usuario que no hay coincidencias. Si hay resultados, muestra detalles como ruta, horarios, duración, plazas disponibles, y precio.
- **Reserva sencilla:** Cada viaje listado incluye un botón para reservar, que abre un modal de reserva donde el usuario puede continuar con el proceso.
- **Interfaz visual:** Utiliza componentes visuales como SafeAreaView, ScrollView, ActivityIndicator, y diferentes estilos para optimizar la experiencia de usuario.
- **Control de estado y feedback:** Informa al usuario si la búsqueda está cargando y si hay plazas libres en los viajes encontrados.



## Myprofile.tsx

Este archivo contiene el componente de React Native para la pantalla de perfil de usuario 

- **Visualización del perfil:** Muestra el nombre y correo electrónico del usuario autenticado.
- **Acceso a términos y condiciones:** Incluye un botón para navegar hasta la pantalla de Términos y Condiciones.
- **Opciones según permisos o rol:**
    - Si el usuario es administrador o tiene permisos de escáner, muestra acceso al escáner QR.
    - Si el usuario es administrador, añade una opción para gestionar operadores de escáner.
- **Cerrar sesión:** Proporciona un botón para cerrar la sesión del usuario y redirigirlo a la pantalla de login.
- **Navegación:** Usa el hook `useRouter` de Expo Router para permitir la navegación entre pantallas.
- **Uso de contexto:** Utiliza `useAuth` para acceder a los datos del usuario y a la función de logout.
- **Diseño visual:** Aplica estilos para presentar los botones, la imagen y la información de usuario de forma ordenada y amigable.



## login.tsx y sign_up.tsx


- **Autenticación de usuario:** Permite a los usuarios iniciar sesión o registrarse con su correo electrónico o nombre de usuario y contraseña.
- **Gestión de estado y retroalimentación:** Muestra un indicador de carga mientras se procesa la autenticación y maneja posibles mensajes de error en un alerta si la autenticación falla.
- **Diseño visual personalizado:** Usa componentes personalizados (`ThemedButton`, `ThemedInput`, `ThemedText`) y estilos propios para la presentación visual.
- **Navegación:** Redirige al usuario a la pantalla principal de la aplicación (`/(tabs)/home`) tras un inicio de sesión exitoso, y permite navegar hacia la pantalla de registro si el usuario no tiene cuenta.
- **Experiencia de usuario mejorada:** Usa un logo personalizado, tipografías y colores corporativos, así como ajuste del teclado para una mejor experiencia al completar el formulario.

## Scanner-users.tsx

Este archivo define el componente correspondiente a la pantalla de gestión de operadores de escaneo QR para una aplicación móvil.

- **Restricción de acceso:** Solo los usuarios con rol de “ADMIN” pueden acceder a esta pantalla. Si el usuario no está autenticado, es redirigido a la pantalla de login; si no tiene permisos, es redirigido a la pantalla principal.
- **Formulario de alta para operadores QR:**
  - Permite ingresar nombre completo, email, contraseña (mínimo 6 caracteres) y datos de agencia como nombre (campo obligatorio), teléfono y dirección (ambos opcionales).
  - Ejecuta validación de campos requeridos y de longitud mínima de la contraseña.
  - Al crear el usuario, realiza la petición de alta mediante la función `createScannerOperator` y notifica con alertas sobre éxito o error.
  - Tras crear un operador exitosamente, se limpian los campos del formulario.
- **Interfaz y diseño:** Utiliza estilos personalizados para mostrar el formulario y los distintos elementos de la pantalla, manteniendo una coherencia visual con el resto de la aplicación.


## scanner.tsx

Implementa la pantalla/scanner de QR para el control de billetes y pasajeros en una aplicación móvil.

- **Restricción de acceso:** Solo usuarios autorizados (con rol `ADMIN`, `SCANNER` o marcado con `scannerEnabled`) pueden acceder. Si no, redirige al login o a la pantalla principal.
- **Selección y activación de viaje:** Permite al operador seleccionar de una lista el viaje a supervisar, opcionalmente proporcionando un código de acceso. Activa una "sesión de escaneo" para ese viaje, que permite validar pasajeros.
- **Gestión de sesiones activas:** Muestra información de la sesión activa (ID, viaje, código).
- **Lectura y validación de QR:** Usa la cámara para leer códigos QR de billetes y muestra una previsualización antes de validarlo definitivamente, con datos del pasajero y viaje. Permite también la entrada manual del QR (por ejemplo, si hay problemas con la cámara o el formato).
- **Validación manual del documento:** Permite especificar un identificador/pasaporte presentado por el pasajero, usado durante la validación del QR.
- **Control de pasajeros verificados:** Tras cada validación de QR, actualiza y muestra la lista de pasajeros y su estado (hasta 80 por viaje).
- **Feedback de resultados:** Tras cada verificación, muestra información detallada del último billete validado y del pasajero correspondiente.
- **Gestión de permisos de cámara:** Solicita, verifica, y gestiona los permisos de cámara para poder escanear los QR.
- **Interfaz modal de previsualización:** Muestra una previsualización detallada del pasajero encontrado en el QR antes de que el operador decida verificarlo.
- **Gestión de estados:** Maneja correctamente los estados de carga, errores, botones deshabilitados, procesos en curso y vaciado de datos para evitar validaciones repetidas o indeseadas.


## BookingModal.tsx

Se encarga de la reserva de viajes dentro de la aplicación móvil. Las funciones y características principales de este componente son:

- **Resumen del viaje:** Muestra un resumen detallado del viaje seleccionado, incluyendo origen, destino, fechas, duración, precio por persona y plazas libres.
- **Selección de tipo de reserva:** Permite elegir entre viaje solo de ida ("ONEWAY") o ida y vuelta ("ROUNDTRIP"). Si se elige ida y vuelta, gestiona la búsqueda y opción de selección de viaje de regreso relacionado.
- **Selección de viaje de vuelta:** Si el usuario elige “ida y vuelta”, busca automáticamente posibles viajes de retorno (inversos) y permite elegir uno compatible. Incluye mensajes y estados de carga mientras se buscan/filtran los viajes de regreso.
- **Cantidad de pasajeros:** Permite al usuario especificar entre 1 y 10 pasajeros. La información del formulario de pasajero se actualiza dinámicamente según la cantidad seleccionada.
- **Formulario de pasajeros:** Genera un formulario para cada pasajero, pidiendo nombre completo, identificación, teléfono y (para el primer pasajero) correo electrónico de contacto.
- **Cálculo del precio total:** Calcula el precio final en función del tipo de viaje, la tarifa individual y la cantidad de pasajeros.
- **Pago con Stripe:** Al pulsar "Ir al pago", valida los datos e inicia el proceso de pago con Stripe, redirigiendo al usuario a la pasarela de pagos y manejando los resultados según plataforma (web o app móvil).
- **Gestión de estados:** Controla y refleja el estado del proceso (cargando, procesando, errores, etc.) con indicadores y mensajes amigables.
- **Restablecimiento y control modal:** Al abrir/cerrar el modal, restablece el estado de los formularios y selecciones relevantes para permitir nuevas reservas de forma limpia.

## Explore.tsx

El archivo `explore.tsx` implementa la pantalla "Mis Viajes" de la aplicación móvil, donde los usuarios pueden visualizar y gestionar sus billetes y reservas de viaje.

- **Listado de viajes comprados:** Solicita y muestra todos los viajes comprados por el usuario, agrupando y organizando los billetes (tickets) a partir de órdenes/ventas recuperadas mediante la función `getMyOrders`.
- **Clasificación de estado:** Cada viaje/billete tiene un estado calculado (Activo, Completado, Expirado) según su información de uso, fecha y estado:  
  - Activo: viajable y vigente  
  - Completado: ya finalizado por fecha o uso  
  - Expirado: cancelado, reembolsado o caducado
- **Detalles por billete:** Presenta la ruta, fecha/hora, agencia y otros datos; muestra una insignia visual (badge) de color y texto según el estado de cada ticket.
- **Navegación a detalle:** Al tocar un viaje, redirige a una pantalla de detalle donde se puede ver el QR y más información del billete (gestionar billete).
- **Actualización y recarga:** Permite refrescar la lista (pull to refresh) para traer nuevos datos o resolver errores de conexión.
- **Gestión de errores y estados:** Muestra mensajes de carga, errores y ausencia de viajes, con opción de reintentar la carga.
- **Interfaz visual amigable:** Estética consistente con la app (colores, iconos, sombras, badges de estado), uso de listas rápidas con FlatList y componentes visuales reutilizables.



