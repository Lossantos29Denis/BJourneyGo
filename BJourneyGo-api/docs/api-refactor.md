# API Refactor Log

Objetivo: reducir acoplamiento en el arranque de la API, corregir la base de compilación y avanzar en pasos pequeños que puedan validarse después de cada cambio.

## Paso 1

Hecho:
- Se extrajo la creación de la app Express a `src/server/app.ts`.
- `src/server/index.ts` quedó centrado solo en checks de arranque y `listen`.
- Se añadió `rootDir: ./src` a `tsconfig.json` para que TypeScript compile con una salida coherente.

## Paso 2

Hecho:
- Se eliminó un handler duplicado en `src/routes/express/public.ts` para `POST /checkin/update-contact`.
- Se dejó la ruta real de actualización como la única implementación activa.

## Paso 3

Hecho:
- Se movió el registro de rutas a `src/server/routeRegistry.ts`.
- `src/server/app.ts` ahora solo crea la app y monta el registro común una vez por prefijo.

## Paso 4

Hecho:
- Se extrajo el catálogo público de viajes a `src/routes/express/catalog.ts`.
- `src/routes/express/public.ts` quedó limitado a check-in y contacto.

## Paso 5

Hecho:
- Se extrajeron de `src/routes/express/orders.ts` las rutas de alternativas, cambio y cancelación de billetes a `src/routes/express/orderTickets.ts`.
- `src/routes/express/orders.ts` quedó centrado en compra y listado de pedidos.

## Paso 6

Hecho:
- Se extrajo el formulario de contacto a `src/routes/express/contact.ts`.
- `src/routes/express/public.ts` quedó centrado solo en check-in.

## Paso 7

Hecho:
- `src/routes/express/public.ts` y `src/routes/express/orders.ts` ahora delegan la lógica a handlers y servicios pequeños.
- El comportamiento público de la API se mantiene, pero el código quedó más fácil de extender y probar.

## Paso 8

Hecho:
- Se unificaron los normalizadores de entrada en `src/routes/express/utils/inputParsers.ts`.
- Se extrajo la verificación de acceso a pedidos en `src/routes/express/utils/accessControl.ts`.

## Paso 9

Hecho:
- La validación de entrada del flujo de check-in se movió a `src/routes/express/utils/checkinValidators.ts`.
- `src/routes/express/handlers/publicHandlers.ts` quedó más centrado en orquestar respuestas.

## Paso 10

Hecho:
- `src/routes/express/auth.ts` quedó como ensamblador de rutas.
- Se extrajeron `registerAuthEmailHandlers`, `registerAuthProfileHandlers` y `registerAuthSessionHandlers`.
- El comportamiento de registro, verificación, recuperación de contraseña, sesión y perfil se mantuvo, pero ahora está dividido por familias.

## Paso 11

Hecho:
- `src/routes/express/agency.ts` quedó como ensamblador.
- Se extrajeron `registerAgencyHandlers` con las rutas de creación de routes y trips.
- La validación de agencia y autorización se mantuvo sin cambios.

## Paso 12

Hecho:
- `src/routes/express/tickets.ts` quedó como ensamblador.
- Se extrajeron `registerTicketsHandlers` con los endpoints de lookup y verify.
- Se crearon utilidades de normalización en `ticketValidators.ts` (normalizeText, identifierCandidates, identifiersMatch).
- La lógica de ventana de verificación y matching de identificadores se mantuvo sin cambios.

## Paso 13

Hecho:
- `src/routes/express/orderTickets.ts` quedó como ensamblador.
- Se extrajeron `registerOrderTicketsHandlers` con los tres endpoints: alternatives, change-trip, cancel.
- La lógica de transacciones, validaciones de disponibilidad y updateos de asientos se mantuvo sin cambios.

## Paso 14

Hecho:
- `src/routes/express/catalog.ts` quedó como ensamblador.
- Se extrajeron `registerCatalogTripsHandlers` (búsqueda y detalle de viajes) y `registerCatalogDataHandlers` (rutas, buses, documentos).
- Ambos handlers acceden a la BD pero sin lógica compartida, solo lectura pública.

## Paso 15

Hecho:
- `src/routes/express/contact.ts` quedó como ensamblador.
- Se extrajo `registerContactHandlers` con el único endpoint POST /contact.
- La validación de email y saneamiento de inputs se mantuvo sin cambios.

## Paso 16

Hecho:
- `src/routes/express/offlineVerify.ts` quedó como ensamblador.
- Se extrajo `registerOfflineVerifyHandlers` con POST /verify-offline.
- La lógica de transacciones y matching de identificadores se mantuvo sin cambios.

## Paso 17

Hecho:
- `src/routes/express/adminEmailTokens.ts` quedó como ensamblador.
- Se extrajo `registerAdminEmailTokensHandlers` con 4 endpoints:
  - GET / - listar tokens
  - GET /:jti - detalle de token
  - POST /revoke - revocar token
  - GET /verification-logs - logs de verificación
- Todos protegidos con verificación de rol ADMIN.

## Paso 18

Hecho:
- Se creó `src/routes/express/utils/paymentUtils.ts` con helpers compartidos de pagos:
  - `extractOptionalUserId` - extraer userId del token JWT
  - `parsePositiveInt`, `resolveTripIds` - parseo de entrada
  - `normalizePassengers` - normalizar datos de pasajeros
  - `resolveCheckoutReturnUrl`, `appendCheckoutSessionId` - utilidades de Stripe
  - `buildOrderSummary` - construir resumen de orden con billetes
- Estos helpers se usarán en los handlers de pagos que se extraigan próximamente.

Próximo paso sugerido:
- Crear `stripePaymentHandlers.ts` con los endpoints POST /stripe/checkout y POST /stripe/confirm.
- Luego extraer `paymentProcessingHandlers.ts` con POST /reconcile y POST /test-purchase.
- Finalmente, crear `ticketPdfHandlers.ts` con GET /tickets/:uuid/pdf.