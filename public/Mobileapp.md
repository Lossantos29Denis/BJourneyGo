# DOCUMENTACIÓN ARCHIVOS PRINCIPALES

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
- **Gestión de estado:** Muestra un indicador de carga mientras se procesa la autenticación y maneja posibles mensajes de error en un alerta si la autenticación falla.
- **Diseño visual:** Usa componentes personalizados (`ThemedButton`, `ThemedInput`, `ThemedText`) y estilos propios para la presentación visual.
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


# DOCUMENTACIÓN FUNCIONES AUXILIARES

Dentro de la carpeta utils estan las funciones puramente utilitarias.

## types.ts

### 1. `BookingType`

- **Descripción:**  
  Tipo literal restringido con los valores posibles para el tipo de reserva:
  - `'ONEWAY'` — Solo ida
  - `'ROUNDTRIP'` — Ida y vuelta

### 2. `Leg`

- **Descripción:**  
  Tipo literal para representar la dirección/tramo de viaje:
  - `'outbound'` — Trayecto de ida
  - `'return'` — Trayecto de vuelta

### 3. `TripItem`

- **Descripción:**  
  Estructura que representa un viaje individual y toda su información relevante.

- **Campos:**
  - `id`: `number` — Identificador único del viaje (obligatorio).
  - `routeCode?`: `string` — Código de la ruta de viaje (opcional).
  - `origin?`: `string` — Ciudad/lugar de origen (opcional).
  - `destination?`: `string` — Ciudad/lugar de destino (opcional).
  - `departureAt?`: `string` — Fecha y hora de salida (opcional, formato texto).
  - `arrivalAt?`: `string` — Fecha y hora de llegada (opcional, formato texto).
  - `capacity?`: `number` — Capacidad máxima de plazas/asientos (opcional).
  - `seatsSold?`: `number` — Plazas/asientos ya vendidos (opcional).
  - `basePrice?`: `number` — Precio base por pasajero (opcional).


### 4. `PassengerForm`

- **Descripción:**  
  Modelo para la información que se recopila sobre cada pasajero durante la reserva.

- **Campos:**
  - `fullName`: `string` — Nombre completo del pasajero.
  - `identification`: `string` — Identificación personal (DNI/pasaporte u otro).
  - `phone`: `string` — Teléfono de contacto.
  - `email`: `string` — Correo electrónico del pasajero.


## date.ts

Estas funciones están diseñadas para convertir, formatear y calcular duraciones a partir de cadenas de texto con fechas y horas.


### 1. `parseLocalDateTime(value?: string): Date`

**Descripción:**  
Convierte una cadena de texto que representa una fecha y hora (en formato `YYYY-MM-DD HH:MM[:SS]`) en un objeto `Date` de JavaScript.

- Si el texto es vacío o indefinido, retorna un `Date` inválido (`new Date(NaN)`).
- Si el texto tiene el formato adecuado (ejemplo: `"2024-06-18 14:30"`), crea un objeto `Date` con esos valores en el horario local.
- Si no cumple el formato, intenta crear una fecha usando el valor crudo.


### 2. `formatDateTime(value?: string): string`

**Descripción:**  
Formatea una cadena de texto de fecha/hora a una versión amigable para humanos en español (`es-ES`), usando la función anterior para el parseo.

- Si la fecha es inválida o no existe, retorna `"Fecha pendiente"`.
- Si es válida, la muestra en formato local con día, mes, año, hora y minutos (ejemplo: `"18/06/2024 14:30"`).


### 3. `durationLabel(start?: string, end?: string): string`

**Descripción:**  
Calcula y muestra la duración entre dos fechas/hora (inicio y fin), expresada en horas y minutos (por ejemplo: `"2h 30m"`).

- Si alguna de las fechas es inválida, retorna `"Duracion pendiente"`.
- Si las fechas son válidas, calcula la diferencia en minutos y la expresa como horas y minutos.


## storage.ts

El objeto `storage` encapsula funciones asíncronas para manipular el almacenamiento local usando `AsyncStorage` en React Native. Todas las funciones manejan errores internamente para evitar que excepciones detengan la ejecución de tu app.

### 1. `getItem(key: string): Promise<string | null>`

- **Descripción:**  
  Recupera (lee) el valor almacenado bajo la clave especificada (`key`).  
- **Retorna:**  
  Una promesa cuya resolución es el valor almacenado (tipo `string`) o `null` si la clave no existe o ocurre un error.


### 2. `setItem(key: string, value: string): Promise<void>`

- **Descripción:**  
  Guarda un valor (`value`) bajo la clave (`key`). Sobrescribe si ya existe un valor previo.
- **Retorna:**  
  Una promesa que se resuelve cuando la operación finaliza (sin retornar valor).  
- **Notas:**  
  Si ocurre un error, se registra en consola pero no lanza excepción.


### 3. `removeItem(key: string): Promise<void>`

- **Descripción:**  
  Elimina la clave y su valor asociado del almacenamiento local.
- **Retorna:**  
  Una promesa que se resuelve cuando la operación finaliza (sin retornar valor).  
- **Notas:**  
  Si ocurre un error, se registra en consola.


### 4. `clear(): Promise<void>`

- **Descripción:**  
  Elimina **todos** los datos almacenados en `AsyncStorage`.
- **Retorna:**  
  Una promesa que se resuelve cuando la operación finaliza (sin retornar valor).  
- **Notas:**  
  Si ocurre un error, se registra en consola.



## booking.ts

### 1. seatsLeft(t: TripItem)

**Descripción:**  
Calcula cuántos asientos libres quedan en un viaje específico (`TripItem`).  
Resta la cantidad de asientos vendidos (`seatsSold`) de la capacidad total (`capacity`). Nunca retorna un número menor a cero.

**Parámetro:**  
- `t`: Objeto de tipo `TripItem`.

**Retorna:**  
- Número de asientos disponibles (`number`).

### 2. `buildPassengers(quantity: number): PassengerForm[]`

**Descripción:**  
Genera un arreglo de formularios de pasajero vacíos (tipo `PassengerForm`), útil para inicializar formularios donde los usuarios introducirán sus datos.

**Parámetro:**  
- `quantity`: Número de pasajeros a crear.

**Retorna:**  
- Array de objetos `PassengerForm` con campos vacíos.

#### 3. `normalizeTrips(payload: any): TripItem[]`

**Descripción:**  
Convierte y normaliza una estructura de datos cruda en un array de objetos `TripItem`.  
Asegura que todos los campos numéricos sean valores numéricos y los campos opcionales reciban valores por defecto si vienen indefinidos.

**Parámetro:**  
- `payload`: Objeto recibido con un array esperado en `payload.trips`.

**Retorna:**  
- Array de objetos `TripItem` en formato consistente y válido.




