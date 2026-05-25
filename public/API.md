# BJourneyGo API

Presentacion tecnica completa de la API. Incluye arquitectura, montaje de rutas, seguridad, contratos, modelos conceptuales y catalogo detallado de endpoints con inputs/outputs reales.

## 1) Arquitectura tecnica

- Runtime: Node.js.
- Lenguaje: TypeScript.
- Framework: Express.
- ORM: Prisma (MySQL).
- Logs: morgan (combined).
- Uploads: carpeta /uploads con express.static.
- Swagger: /docs y /documentation/json.

Montaje de rutas:
- Todas las rutas se montan en / y en /api.
- Mismo router para ambos prefijos.

## 2) Entornos y base URL

Ejemplos:
- Local: http://localhost:4000
- Produccion: https://api.tu-dominio.com

Prefijo:
- Este documento usa /api por claridad.

## 3) Seguridad y autenticacion

JWT:
- Authorization: Bearer <JWT>.
- Access tokens expiran en 15m.
- Refresh tokens con TTL configurable (REFRESH_TOKEN_TTL_SECONDS).
- Logout revoca refresh token y mete access token en AccessTokenBlacklist.

Roles:
- USER
- ADMIN
- AGENCY_ADMIN
- AGENCY_WORKER
- SCANNER (a nivel de UI, se asigna como USER + scanner_enabled)

Flags relevantes:
- MAIL_DISABLED: desactiva envio de correos.
- QR_VERIFY_EARLY_MINUTES, QR_VERIFY_LATE_MINUTES, QR_VERIFY_ENFORCE_WINDOW.

## 4) Variables de entorno (principales)

Base:
- DATABASE_URL
- JWT_SECRET
- PORT

Correo:
- SMTP_HOST, SMTP_PORT, SMTP_SECURE
- SMTP_USER, SMTP_PASS
- SMTP_FROM, SMTP_FROM_NAME
- MAILJET_API_KEY, MAILJET_API_SECRET, MAILJET_FROM_EMAIL, MAILJET_FROM_NAME
- WEB_URL (usado para enlaces de reset)

Pagos:
- STRIPE_SECRET_KEY
- STRIPE_SUCCESS_URL
- STRIPE_CANCEL_URL
- STRIPE_CURRENCY
- COMMISSION_DEFAULT_PERCENT
- PAYMENT_WEBHOOK_SECRET
- DISABLE_TEST_PURCHASE

Uploads:
- UPLOADS_DIR
- DOCS_MAX_UPLOAD_BYTES

## 5) Modelos conceptuales (fields observados)

User:
- id, uuid, email, name, phone, phone_country, role, is_verified, created_at, updated_at

Agency:
- id, name, tax_id, contact_email, phone, address, stripe_account_id, commission_percent, payout_active, status, created_at, updated_at

AgencyWorker:
- id, user_id, agency_id, role, scanner_enabled, active

Route:
- id, code, origin, destination, distance_km, duration_minutes, status, agency_id, created_at, updated_at

Trip:
- id, route_id, bus_id, departure_at, arrival_at, status, capacity, seats_sold, base_price

Order:
- id, user_id, reference_code, contact_email, contact_phone, total_amount, currency, status, created_at, updated_at, payment_method

OrderPassenger:
- order_id, passenger_index, full_name, identification, phone, is_contact

Ticket:
- id, uuid, order_id, trip_id, passenger_name, passenger_identification, passenger_phone, is_contact, seat_number, price, currency, status, issued_at, expires_at, qr_token, verification_count, verified_at, verified_by_id, owner_user_id

PaymentRecord:
- id, order_id, provider, provider_ref, amount, currency, fee, status, created_at, updated_at, captured_at, refunded_at

ScannerSession:
- id, user_id, agency_worker_id, agency_id, trip_id, access_code, status, started_at, expires_at, ended_at, created_at, updated_at

ScannerOperatorTripAccess:
- operator_user_id, trip_id, agency_id, active

EmailToken:
- id, jti, user_id, purpose, expires_at, used, used_at, revoked, created_at

EmailVerificationLog:
- id, user_id, email, token_jti, verified_at, ip_address, user_agent, created_at

SystemConfig:
- scope, agency_id, config_key, config_value, created_at, updated_at

VerificationLog:
- ticket_id, checked_by_user_id, agency_worker_id, result, checked_at, device_info, location

## 6) Convenciones HTTP

Headers:
- Content-Type: application/json
- Authorization: Bearer <JWT>

Codigos esperados:
- 200/201: OK
- 400: validacion
- 401: no autenticado
- 403: sin permisos
- 404: no encontrado
- 409: conflicto
- 429: rate limit
- 500: error interno

## 7) Endpoints (detalle tecnico)

### 7.1 Auth: registro, verificacion, login

POST /api/auth/register
Body:
- email (required)
- password (required)
- name (opcional)

Response:
```
{ "success": true, "verificationRequired": true, "verificationId": "jti", "email": "...", "MAIL_DISABLED": false }
```

GET /api/auth/verify?token=...
Response:
```
{ "success": true }
```

GET /api/auth/verify-status?jti=...
Response:
```
{ "success": true, "verified": false, "expired": false, "revoked": false }
```

POST /api/auth/resend-verify (auth)
Response:
```
{ "success": true }
```

POST /api/auth/resend-verify-public
Body:
- email
- verificationId

Response:
```
{ "success": true, "verificationId": "new-jti" }
```

POST /api/auth/login
Body:
- identity | email
- password

Response:
```
{ "success": true, "token": "...", "refreshToken": "...", "role": "ADMIN", "isAdmin": true, "user": "...", "email": "...", "agencyId": "...", "agencyName": "...", "scannerEnabled": true }
```

POST /api/auth/refresh
Body:
- refreshToken

Response:
```
{ "success": true, "token": "..." }
```

POST /api/auth/logout
Body:
- refreshToken

Response:
```
{ "success": true }
```

### 7.2 Auth: perfil

GET /api/auth/me (auth)
Response:
```
{ "user": { "id": 1, "email": "...", "name": "...", "phone": "...", "phoneCountry": "...", "role": "ADMIN", "isVerified": true, "scannerEnabled": true, "agencyId": 1, "agencyName": "..." } }
```

PUT /api/auth/me (auth)
Body:
- name | phone | phoneCountry

Response:
```
{ "success": true, "user": { "id": 1, "email": "...", "name": "...", "role": "...", "phone": "...", "phoneCountry": "..." } }
```

POST /api/auth/me/change-password (auth)
Body:
- currentPassword
- newPassword

Response:
```
{ "success": true }
```

DELETE /api/auth/me (auth)
Body:
- currentPassword

Response:
```
{ "success": true }
```

### 7.3 Auth: reset de contrasena

POST /api/auth/send-reset
Body:
- email

Response:
```
{ "success": true }
```

POST /api/auth/reset
Body:
- token
- password

Response:
```
{ "success": true }
```

### 7.4 Catalogo publico

GET /api/trips
Query:
- q (opcional)
- origin, destination
- startDate, endDate (YYYY-MM-DD)

Response:
```
{ "trips": [ { "id": 1, "routeId": 2, "routeCode": "MAD-BCN", "origin": "Madrid", "destination": "Barcelona", "departureAt": "2026-05-19 08:30:00", "arrivalAt": "2026-05-19 12:30:00", "capacity": 50, "seatsSold": 12, "basePrice": 25 } ] }
```

GET /api/trips/:id
Response:
```
{ "trip": { "id": 1, "routeId": 2, "routeCode": "MAD-BCN", "origin": "Madrid", "destination": "Barcelona", "busId": 3, "departureAt": "...", "arrivalAt": "...", "capacity": 50, "seatsSold": 12, "basePrice": 25 } }
```

GET /api/routes
Response:
```
{ "routes": [ { "id": 1, "code": "MAD-BCN", "origin": "Madrid", "destination": "Barcelona", "distanceKm": 600, "durationMinutes": 240, "status": "ACTIVE" } ] }
```

GET /api/buses
Response:
```
{ "buses": [ { "id": 1, "plate": "1234-ABC", "agencyId": 1, "capacity": 50 } ] }
```

GET /api/documents
Response:
```
{ "documents": [ { "id": 1, "agencyId": 1, "title": "...", "category": "...", "description": "...", "fileUrl": "/uploads/...", "fileSize": "1.2 MB", "createdAt": "...", "updatedAt": "..." } ] }
```

### 7.5 Contacto

POST /api/contact
Body:
- name
- email
- subject (opcional)
- message

Response:
```
{ "success": true }
```

### 7.6 Check-in publico

POST /api/checkin/lookup
Body:
- referenceCode
- identifier

Response:
```
{ "order": { "referenceCode": "BJ-XXXX", "status": "PAID", "totalAmount": 50, "currency": "EUR", "contactEmail": "...", "contactPhone": "..." }, "tickets": [ { "uuid": "...", "routeCode": "...", "origin": "...", "destination": "...", "departureAt": "...", "passengerName": "...", "passengerIdentification": "...", "status": "ACTIVE", "qrToken": "..." } ] }
```

POST /api/checkin/update-contact
Body:
- referenceCode
- identifier
- contactEmail (opcional)
- contactPhone (opcional)

Response:
```
{ "success": true }
```

### 7.7 Pedidos

POST /api/orders/purchase (auth)
Body:
- tripId
- quantity
- paymentProvider (opcional)
- providerRef (opcional)

Response:
- Depende del servicio orderService (order + tickets).

GET /api/orders/my (auth)
Response:
```
{ "orders": [ { "id": 1, "referenceCode": "BJ-XXXX", "status": "PAID", "totalAmount": 50, "currency": "EUR", "tickets": [ ... ] } ] }
```

GET /api/orders/:id (auth)
Response:
```
{ "order": { ... }, "tickets": [ ... ] }
```

### 7.8 Billetes alternativos

GET /api/orders/tickets/:uuid/alternatives (auth)
Query:
- days (opcional, default 7, max 30)

Response:
```
{ "ticket": { "uuid": "...", "tripId": 1, "routeCode": "...", "origin": "...", "destination": "...", "departureAt": "...", "arrivalAt": "..." }, "alternatives": [ { "id": 2, "departureAt": "...", "arrivalAt": "...", "capacity": 50, "seatsSold": 10, "basePrice": 25, "routeCode": "...", "origin": "...", "destination": "..." } ] }
```

POST /api/orders/tickets/:uuid/change-trip (auth)
Body:
- newTripId

Response:
```
{ "success": true, "ticket": { "uuid": "...", "tripId": 2, "departureAt": "...", "arrivalAt": "...", "qrToken": "..." } }
```

POST /api/orders/tickets/:uuid/cancel (auth)
Response:
```
{ "success": true, "ticket": { "uuid": "...", "status": "CANCELLED" }, "refundProcessed": false }
```

### 7.9 Tickets y QR (staff)

GET /api/tickets/lookup/:uuid (auth)
Response:
```
{ "ticket": { "uuid": "...", "passengerName": "...", "status": "ACTIVE", "qrToken": "..." } }
```

POST /api/tickets/verify (auth, staff)
Body:
- ticketUuid
- tripId
- presentedId (opcional)

Response:
```
{ "ok": true, "ticket": { "uuid": "...", "passengerName": "..." }, "passengers": [ { "uuid": "...", "fullName": "...", "identification": "..." } ] }
```

GET /api/tickets/:uuid/pdf
Response:
- PDF binario (Content-Type: application/pdf)

### 7.10 Escaner QR y sesiones

GET /api/tickets/scanner/operators (auth)
Response:
```
{ "operators": [ { "userId": 1, "email": "...", "name": "...", "agencyWorkerId": 2, "agencyId": 3, "agencyName": "..." } ] }
```

GET /api/tickets/scanner/operators/:operatorUserId/access (auth)
Response:
```
{ "access": [ { "tripId": 1, "departureAt": "...", "arrivalAt": "...", "origin": "...", "destination": "...", "routeCode": "...", "agencyId": 3, "agencyName": "..." } ] }
```

PUT /api/tickets/scanner/operators/:operatorUserId/access (auth)
Body:
- tripIds[]

Response:
```
{ "success": true, "operatorUserId": 1, "tripIds": [1,2,3] }
```

POST /api/tickets/scanner/admin/start-session (auth)
Body:
- operatorUserId
- tripId
- accessCode (opcional)

Response:
```
{ "success": true, "operator": { "userId": 1, "email": "...", "name": "...", "agencyId": 3 }, "session": { "id": 10, "tripId": 1, "accessCode": "ABC123", "departureAt": "..." } }
```

GET /api/tickets/scanner/trips (auth)
Query:
- date (opcional, YYYY-MM-DD)

Response:
```
{ "trips": [ { "id": 1, "departureAt": "...", "arrivalAt": "...", "routeCode": "...", "origin": "...", "destination": "...", "agencyName": "..." } ] }
```

POST /api/tickets/scanner/start-session (auth)
Body:
- tripId
- accessCode (opcional)

Response:
```
{ "success": true, "session": { "id": 10, "tripId": 1, "accessCode": "ABC123", "departureAt": "..." } }
```

POST /api/tickets/preview-qr (auth)
Body:
- qrPayload
- tripId (opcional)
- scannerSessionId (opcional)
- accessCode (opcional)

Response:
```
{ "ok": true, "session": { "id": 10, "tripId": 1 }, "ticket": { "uuid": "...", "passengerName": "...", "routeCode": "..." }, "passengers": [ ... ] }
```

GET /api/tickets/scanner/active-session (auth)
Response:
```
{ "session": { "id": 10, "tripId": 1, "accessCode": "ABC123", "departureAt": "..." } }
```

GET /api/tickets/scanner/trips/:tripId/passengers (auth)
Response:
```
{ "trip": { "id": 1, "routeCode": "...", "origin": "...", "destination": "..." }, "passengers": [ { "uuid": "...", "passengerName": "...", "passengerIdentification": "...", "status": "ACTIVE" } ] }
```

POST /api/tickets/verify-qr (auth)
Body:
- qrPayload
- presentedId (opcional)
- tripId (opcional)
- scannerSessionId (opcional)
- accessCode (opcional)

Response:
```
{ "ok": true, "session": { "id": 10, "tripId": 1 }, "ticket": { "uuid": "...", "passengerName": "...", "routeCode": "...", "status": "USED" }, "passengers": [ ... ] }
```

### 7.11 Verificacion offline

POST /api/tickets/verify-offline (auth)
Body:
- records[]: { ticketUuid, presentedId, checkedAt, deviceInfo, location, result }

Response:
```
{ "results": [ { "ticketUuid": "...", "result": "OK" } ] }
```

### 7.12 Pagos (Stripe y reconciliacion)

POST /api/payments/stripe/checkout
Body:
- quantity (int)
- passengers[]
- contactEmail
- successUrl (opcional)
- cancelUrl (opcional)
- tripId o outboundTripId + returnTripId

Response:
```
{ "success": true, "url": "...", "sessionId": "...", "orderId": 10, "referenceCode": "BJ-XXXX" }
```

POST /api/payments/stripe/confirm
Body:
- sessionId

Response:
```
{ "success": true, "purchase": { ... }, "ok": true, "payment": { ... } }
```

POST /api/payments/reconcile
Body:
- provider, providerRef, status
- amount, currency (opcional)
- orderId, tripId, outboundTripId, returnTripId (opcional)
- quantity (opcional)

Response:
```
{ "ok": true, "payment": { "provider": "stripe", "providerRef": "...", "status": "CAPTURED" } }
```

POST /api/payments/test-purchase
Body:
- quantity
- passengers[]
- contactEmail
- contactPhone (opcional)
- tripId o outboundTripId + returnTripId

Response:
```
{ "success": true, "orderId": 10, "referenceCode": "BJ-XXXX", "contactEmail": "...", "contactPhone": "...", "total": 50, "currency": "EUR", "trip": { ... }, "trips": [ ... ], "tickets": [ { "uuid": "...", "qrToken": "..." } ] }
```

### 7.13 Agencia

POST /api/agency/routes (auth)
Body:
- code, origin, destination (required)
- distanceKm, durationMinutes (opcional)

Response:
```
{ "route": { "id": 1, "code": "...", "agencyId": 3, "origin": "...", "destination": "...", "status": "ACTIVE" } }
```

POST /api/agency/trips (auth)
Body:
- routeId, busId, departureAt, arrivalAt (required)
- capacity, basePrice (opcional)

Response:
```
{ "trip": { "id": 1, "routeId": 2, "busId": 3, "departureAt": "...", "arrivalAt": "...", "capacity": 50, "basePrice": 25 } }
```

### 7.14 Admin: agencias

GET /api/admin/agencies (auth/admin)
Response:
```
{ "agencies": [ { "id": 1, "name": "...", "taxId": "...", "contactEmail": "...", "phone": "...", "address": "...", "stripeAccountId": "...", "commissionPercent": 10, "payoutActive": 1, "status": "ACTIVE" } ] }
```

POST /api/admin/agencies (auth/admin)
Body:
- name (required)
- taxId, contactEmail, phone, address
- stripeAccountId, commissionPercent, payoutActive, status

PUT /api/admin/agencies/:id (auth/admin)
Body:
- name, taxId, contactEmail, phone, address
- stripeAccountId, commissionPercent, payoutActive, status

DELETE /api/admin/agencies/:id (auth/admin)

### 7.15 Admin: stats

GET /api/admin/stats (auth)
Response:
```
{ "monthlyRevenue": 0, "ticketsSold": 0, "activeCustomers": 0, "averageOccupancy": 0, "popularRoutes": [ ... ], "monthlySeries": [ ... ], "salesDistribution": [ ... ], "timeSlots": { "s1": 0, "s2": 0, "s3": 0, "s4": 0, "s5": 0 }, "performanceMetrics": { "avgPurchaseMinutes": 0, "conversionRate": 0, "avgTicket": 0, "refundRate": 0, "advanceBookingRate": 0 } }
```

### 7.16 Admin: config

GET /api/admin/config (auth/admin)
Response:
```
{ "config": { "key": "value" } }
```

PUT /api/admin/config (auth/admin)
Body:
- configs (obj)

### 7.17 Admin: users

GET /api/admin/users (auth/admin)
Response:
```
{ "users": [ { "id": 1, "uuid": "...", "email": "...", "name": "...", "phone": "...", "role": "USER", "isVerified": true, "agencyId": 1, "agencyWorkerRole": "AGENCY_ADMIN", "scannerEnabled": 1, "agencyName": "..." } ] }
```

POST /api/admin/users (auth/admin)
Body:
- email, password (required)
- name, role, agencyId
- agencyName, agencyPhone, agencyAddress

PUT /api/admin/users/:id (auth/admin)
Body:
- email, name, role, password (opcional)
- agencyId, agencyName, agencyPhone, agencyAddress

DELETE /api/admin/users/:id (auth/admin)

### 7.18 Admin: routes

GET /api/admin/routes (auth)
POST /api/admin/routes (auth)
PUT /api/admin/routes/:id (auth)
DELETE /api/admin/routes/:id (auth)

Body create/update:
- code, origin, destination
- distanceKm, durationMinutes, status
- basePrice (update)
- agencyId (create)

### 7.19 Admin: trips

GET /api/admin/trips (auth)
POST /api/admin/trips (auth)
POST /api/admin/trips/roundtrip (auth)
PUT /api/admin/trips/:id (auth)
DELETE /api/admin/trips/:id (auth)

Fields:
- routeId, busId, departureAt, arrivalAt, capacity, basePrice, status

### 7.20 Admin: horarios y calendario

GET /api/admin/shifts?month=YYYY-MM
POST /api/admin/shifts
PUT /api/admin/shifts/:id
DELETE /api/admin/shifts/:id

Body:
- userId, shiftDate, shiftType, notes, agencyId

GET /api/admin/calendar-events?month=YYYY-MM
POST /api/admin/calendar-events
PUT /api/admin/calendar-events/:id
DELETE /api/admin/calendar-events/:id

Body:
- title, startAt, endAt, details

### 7.21 Admin: documentos

POST /api/admin/documents/upload (multipart)
- file

GET /api/admin/documents
POST /api/admin/documents
PUT /api/admin/documents/:id
DELETE /api/admin/documents/:id

Body:
- title, category, description, fileUrl, fileSize, agencyId

### 7.22 Admin: personas

GET /api/admin/buses
GET /api/admin/shift-users

### 7.23 Admin: tokens de correo

GET /api/admin/email-tokens?limit=50&offset=0
GET /api/admin/email-tokens/:jti
POST /api/admin/email-tokens/revoke { jti }
GET /api/admin/email-tokens/verification-logs

## 8) Subidas estaticas

Los archivos subidos se sirven desde:
- /uploads/*

## 9) Ejemplos rapidos

### Health
```
curl -I https://api.tu-dominio.com/health
```

### Login
```
curl -X POST https://api.tu-dominio.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@tu-dominio.com","password":"YOUR_PASSWORD"}'
```

### Peticion autenticada
```
curl https://api.tu-dominio.com/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 12) Inventario de archivos (API)

Raiz:
- .env.example: plantilla de variables de entorno (DB, JWT, SMTP, etc.).
- .gitignore: archivos y carpetas ignoradas por Git.
- docker-compose.yml: orquesta MySQL 8.0 y la API con volumenes y red compartida.
- Dockerfile: imagen Node 18 con netcat; espera MySQL antes de iniciar.
- package.json: scripts (dev/build/check-db/seed/create-admin/test) y dependencias clave.
- README.md: guia de setup, variables, migraciones y desarrollo local.
- tsconfig.json: TypeScript ES2020 con strict y NodeNext.
- wait-for-mysql.sh: script de espera por conectividad TCP a MySQL.

docs:
- docs/api-refactor.md: log de refactor y reordenamiento de rutas/handlers.

scripts:
- scripts/seed_sample_data.js: crea datos de ejemplo (agency, routes, trips, users, orders).
- scripts/create_admin.js: crea/actualiza usuario admin con variables ADMIN_*.
- scripts/apply_migration_remote.js: aplica migracion alter_ticket_add_timestamps.sql con chequeos.
- scripts/check_remote_db.js: inspecciona esquema remoto (DDL y triggers de Ticket).
- scripts/recreate_db_remote.js: destruye y recrea schema remoto desde db/schema_init.sql.
- scripts/send-test-mail.js: prueba de envio de email via nodemailer.
- scripts/get-oauth-refresh-token.js: flujo OAuth2 para obtener refresh token SMTP.
- scripts/test_integration_purchase.js: prueba end-to-end de compra.

src/lib:
- src/lib/db.ts: pool MySQL (mysql2/promise), helpers query/transaction y soporte DATABASE_URL.
- src/lib/mailer.ts: envio de email (Mailjet/SMTP) con fallback a stub.
- src/lib/emailTemplates.ts: plantillas HTML/texto con branding y botones de accion.
- src/lib/startupChecks.ts: valida JWT_SECRET, DB, columnas de Ticket y triggers.

src/scripts:
- src/scripts/check-db.ts: test rapido de conectividad a DB.

src/server:
- src/server/app.ts: inicializa Express, CORS, Morgan y rutas; sirve /uploads.
- src/server/index.ts: entrypoint; ejecuta checks y escucha en PORT.
- src/server/middleware.ts: auth JWT, blacklist y resolucion de roles.
- src/server/routeRegistry.ts: registro centralizado de routers.

src/types:
- src/types/express.d.ts: extiende Request con payload de usuario.

src/routes/express:
- src/routes/express/auth.ts: router de autenticacion y perfil.
- src/routes/express/admin.ts: router admin (rutas, viajes, personas, documentos, stats).
- src/routes/express/catalog.ts: catalogo publico (trips y data base).
- src/routes/express/tickets.ts: gestion de tickets del usuario.
- src/routes/express/orders.ts: gestion de ordenes y estado.
- src/routes/express/payments.ts: pagos (Stripe y conciliacion).
- src/routes/express/agency.ts: endpoints de agencia y trabajadores.
- src/routes/express/contact.ts: formulario de contacto.
- src/routes/express/public.ts: check-in publico y update de contacto.
- src/routes/express/health.ts: health check.
- src/routes/express/qr.ts: QR y verificacion de ventana temporal.
- src/routes/express/offlineVerify.ts: verificacion offline.
- src/routes/express/orderTickets.ts: operaciones sobre tickets dentro de ordenes.
- src/routes/express/adminEmailTokens.ts: gestion admin de tokens de email.

src/routes/express/utils:
- src/routes/express/utils/accessControl.ts: helpers de permisos y ownership.
- src/routes/express/utils/authUtils.ts: utilidades de JWT y roles.
- src/routes/express/utils/adminUtils.ts: utilidades admin y normalizacion de datos.
- src/routes/express/utils/checkinValidators.ts: validadores de check-in.
- src/routes/express/utils/inputParsers.ts: normalizacion de referencia, email y telefono.
- src/routes/express/utils/paymentUtils.ts: helpers de pagos y parseo de IDs.
- src/routes/express/utils/ticketChange.ts: reglas y calculos de cambio de ticket.
- src/routes/express/utils/ticketValidators.ts: matching de identificadores con normalizacion.

src/routes/express/handlers:
- src/routes/express/handlers/authEmailHandlers.ts: verificacion email y reset de password.
- src/routes/express/handlers/authProfileHandlers.ts: lectura/actualizacion de perfil.
- src/routes/express/handlers/authSessionHandlers.ts: login, refresh y logout.
- src/routes/express/handlers/catalogDataHandlers.ts: datos de catalogo (origen/destino).
- src/routes/express/handlers/catalogTripsHandlers.ts: busqueda de trips y disponibilidad.
- src/routes/express/handlers/ticketsHandlers.ts: lookup y detalle de tickets.
- src/routes/express/handlers/ticketPdfHandlers.ts: PDF de ticket con QR.
- src/routes/express/handlers/ordersHandlers.ts: ordenes y validacion de acceso.
- src/routes/express/handlers/orderTicketsHandlers.ts: cambios/cancelaciones de tickets.
- src/routes/express/handlers/stripePaymentHandlers.ts: integracion Stripe.
- src/routes/express/handlers/paymentProcessingHandlers.ts: flujo generico de pagos.
- src/routes/express/handlers/publicHandlers.ts: check-in publico y update contacto.
- src/routes/express/handlers/contactHandlers.ts: envio de mensajes de contacto.
- src/routes/express/handlers/offlineVerifyHandlers.ts: verificacion offline.
- src/routes/express/handlers/adminTripsHandlers.ts: CRUD de viajes admin.
- src/routes/express/handlers/adminRoutesHandlers.ts: CRUD de rutas admin.
- src/routes/express/handlers/adminScheduleHandlers.ts: turnos y calendario.
- src/routes/express/handlers/adminPeopleHandlers.ts: usuarios, buses y personal.
- src/routes/express/handlers/adminDocumentsHandlers.ts: gestion de documentos.
- src/routes/express/handlers/adminEmailTokensHandlers.ts: verificacion y logs de tokens.
- src/routes/express/handlers/agencyHandlers.ts: operaciones de agencia.

src/routes/express/services:
- src/routes/express/services/orderService.ts: crea orden, reserva asientos y emite tickets.
- src/routes/express/services/checkinService.ts: lookup de ordenes/tickets por referencia.
- src/routes/express/services/adminTripsService.ts: queries de viajes por agencia.
- src/routes/express/services/adminRoutesService.ts: CRUD de rutas por agencia.
- src/routes/express/services/adminPeopleService.ts: queries de buses y usuarios.
- src/routes/express/services/adminScheduleService.ts: queries de turnos por rango.
- src/routes/express/services/adminDocumentsService.ts: queries de documentos por categoria/agencia.