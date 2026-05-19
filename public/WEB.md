# BJourneyGo Web

Presentacion tecnica completa del front-end web e intranet de BJourneyGo. Incluye arquitectura, rutas, BFF, flujos, almacenamiento local, contratos usados por la UI y componentes clave. Esta version esta pensada para equipos tecnicos y revisiones de arquitectura.

## 1) Stack y arquitectura

- Framework: Astro.
- Render: SSR con adapter Node (modo standalone).
- Runtime: Node.js.
- Deploy: servidor Node con render en tiempo de ejecucion.
- Hosts permitidos (Vite): bjourneygo.me, www.bjourneygo.me.
- Arquitectura BFF: endpoints /api en Astro que proxyfían a la API principal.

## 2) Estructura del proyecto

Carpeta base: BJourneyGo-web/BJourneyGo-web

- src/pages: paginas (rutas) Astro.
- src/pages/intranet: paginas intranet.
- src/pages/api: endpoints server-side de Astro (BFF/proxy).
- src/components: componentes reutilizables.
- src/layouts: layouts base.
- src/styles: estilos globales.
- public: assets estaticos y scripts cliente.
- public/src/scripts: logica de UI y flujos.

Scripts de ejecucion:
- dev: astro dev
- build: astro build
- preview: astro preview

## 3) Rutas web (Astro pages)

Mapeo ruta -> archivo:
- / -> src/pages/index.astro
- /landing -> src/pages/landing.astro
- /inicio -> src/pages/inicio.astro
- /comprar -> src/pages/comprar.astro
- /comprar-pasajeros -> src/pages/comprar-pasajeros.astro
- /pago-exitoso -> src/pages/pago-exitoso.astro
- /pago-cancelado -> src/pages/pago-cancelado.astro
- /compra-prueba-exitosa -> src/pages/compra-prueba-exitosa.astro
- /checkin -> src/pages/checkin.astro
- /login -> src/pages/login.astro
- /register -> src/pages/register.astro
- /verify -> src/pages/verify.astro
- /olvide-contrasena -> src/pages/olvide-contrasena.astro
- /restablecer-contrasena -> src/pages/restablecer-contrasena.astro
- /mis-viajes -> src/pages/mis-viajes.astro
- /intranet-login -> src/pages/intranet-login.astro
- /intranet -> src/pages/intranet.astro
- /estadisticas -> src/pages/estadisticas.astro
- /gestion-usuarios -> src/pages/gestion-usuarios.astro
- /gestion-billetes -> src/pages/gestion-billetes.astro
- /documentos -> src/pages/documentos.astro
- /configuracion -> src/pages/configuracion.astro
- /admin -> src/pages/admin.astro
- /intranet/agencias -> src/pages/intranet/agencias.astro
- /intranet/operadores-scanner -> src/pages/intranet/operadores-scanner.astro
- /intranet/escaner-qr -> src/pages/intranet/escaner-qr.astro
- /intranet/documentos -> src/pages/intranet/documentos.astro
- /intranet/configuracion -> src/pages/intranet/configuracion.astro
- /intranet/calendario-turnos -> src/pages/intranet/calendario-turnos.astro

## 4) BFF / Proxy en Astro (src/pages/api)

Astro actua como puente entre el navegador y la API principal.

Proxy core:
- API_URL configurable por env (default: http://localhost:4000).
- PROXY_TIMEOUT_MS configurable (default: 15000 ms).
- Genera x-request-id por request.
- Soporta forwarding de Authorization header.

Tipos de forwarding:
- forwardJson: JSON request/response.
- forwardBinary: PDF y binarios.
- forwardStream: streams.
- forwardFormData: uploads.

Endpoints BFF principales (resumen):
- /api/login
- /api/logout
- /api/me
- /api/register
- /api/refresh
- /api/resend-verify
- /api/verify
- /api/verify-status
- /api/send-verification
- /api/sync-user
- /api/update-user
- /api/delete-user
- /api/routes
- /api/trips
- /api/documents
- /api/contact
- /api/checkin/lookup
- /api/checkin/update-contact
- /api/orders/my
- /api/payments/test-purchase
- /api/stripe/checkout
- /api/stripe/confirm
- /api/tickets/[uuid]/pdf
- /api/tickets/verify-qr
- /api/tickets/scanner/*
- /api/admin/*

## 5) Autenticacion cliente y almacenamiento local

Almacenamiento principal (localStorage):
- bjourney_token: access token JWT.
- bjourney_refresh: refresh token.
- auth: flag de usuario logueado.
- user: nombre o email visible en UI.
- isAdmin: flag admin.

Intranet (localStorage):
- intranetAuth: flag de acceso intranet.
- intranetUser: usuario intranet.
- intranetRole: admin | agency | scanner.
- intranetIsAdmin: boolean.
- intranetScannerEnabled: boolean.
- agencyId, agencyName: contexto de agencia.

Registro/verificacion (localStorage y sessionStorage):
- pending_verification: flag de verificacion pendiente.
- pending_verification_id: jti del token.
- pending_email: email registrado.
- pending_password (sessionStorage): clave temporal para auto-login tras verificacion.

Compra y post-pago:
- lastPurchaseLookup (sessionStorage): referencia/email para precargar /mis-viajes.

## 6) Cliente HTTP y refresh automatico

public/src/scripts/api.js:
- fetchWithAuth: reintenta en 401 con refresh token.
- refresh: POST /api/refresh con refreshToken.
- clearAuth: limpia tokens y flags en localStorage.

Comportamiento:
- Si no hay access token y existe refresh token, intenta renovar.
- Si refresh falla, limpia session y requiere login.

## 7) Flujos end-to-end (tecnicos)

### 7.1 Compra (one-way / roundtrip)
Entrada:
- /comprar (public/src/scripts/comprar.js)

Inputs:
- origin, destination, startDate, endDate.
- bookingType: ONEWAY / ROUNDTRIP.
- passengers.

Llamadas:
- GET /api/trips?origin&destination&startDate&endDate.

Resultado:
- Normaliza trips y calcula asientos disponibles (capacity - seatsSold).
- En roundtrip: primero se selecciona ida, luego se consulta vuelta.
- Redireccion a /comprar-pasajeros con query params.

Query params de compra:
- bookingType: ONEWAY | ROUNDTRIP.
- tripId, outboundTripId, returnTripId.
- quantity.
- from, to, outboundFrom, outboundTo, returnFrom, returnTo.
- departureAt, outboundDepartureAt, returnDepartureAt.
- unitPrice, outboundUnitPrice, returnUnitPrice.
- seats, routeCode, outboundRouteCode, returnRouteCode.

### 7.2 Datos de pasajeros y pago
Entrada:
- /comprar-pasajeros (public/src/scripts/comprar-pasajeros.js)

Form:
- fullName, identification, phone, email (contacto en pasajero 1).

Llamadas:
- POST /api/stripe/checkout con:
  - quantity
  - passengers[] (fullName, identification, phone, email, isContact)
  - contactEmail
  - tripId o outboundTripId + returnTripId

Salida:
- payload.url -> redireccion a Stripe.

Compra de prueba:
- POST /api/payments/test-purchase con payload similar.

### 7.3 Confirmacion de pago
Entrada:
- /pago-exitoso (public/src/scripts/pago-exitoso.js)

Llamada:
- POST /api/stripe/confirm { sessionId }

Respuesta usada por UI:
- purchase.referenceCode
- purchase.contactEmail
- purchase.total, currency
- purchase.trip (origin, destination, routeCode, departureAt, arrivalAt)
- purchase.tickets[] (passengerName, passengerIdentification, qrToken)

Acciones UI:
- Imprime billete HTML o descarga QR.
- Guarda lastPurchaseLookup en sessionStorage.
- Redirige a /mis-viajes con ref/email.
- Deep link app: bjourneygo://payment/result?status=success&session_id=...

### 7.4 Check-in publico
Entrada:
- /checkin (public/src/scripts/checkin.js)

Llamadas:
- POST /api/checkin/lookup { referenceCode, identifier }
- POST /api/checkin/update-contact { referenceCode, identifier, contactEmail?, contactPhone? }

Respuesta usada:
- order { referenceCode, status, totalAmount, currency, contactEmail, contactPhone }
- tickets[] con routeCode, origin, destination, departureAt, passengerName, passengerIdentification, qrToken.

### 7.5 Mis viajes (usuario autenticado + invitado)
Entrada:
- /mis-viajes (public/src/scripts/mis-viajes.js)

Autenticado:
- GET /api/orders/my
- Renderiza pedidos y tickets, descarga PDF y QR.

Invitado:
- POST /api/checkin/lookup (similar a /checkin)

### 7.6 Registro y verificacion
Registro:
- POST /api/register { email, password }

Verificacion:
- GET /api/verify?token=...
- GET /api/verify-status?jti=...
- POST /api/resend-verify { email, verificationId }

Comportamiento:
- Modal de verificacion y polling cada 4s.
- Auto-login si se conserva pending_password.

### 7.7 Recuperacion de contrasena
- POST /api/auth/send-reset { email }
- POST /api/auth/reset { token, password }

### 7.8 Intranet: login, panel y permisos

Login intranet:
- POST /api/login.
- Si rol admin/agency/scanner o scannerEnabled -> set intranetAuth.

Panel intranet:
- localStorage.intranetRole define cards visibles.

Permisos UI:
- admin: acceso completo.
- agency: acceso limitado.
- scanner: solo escaneo y viajes.

### 7.9 Intranet: escaner QR

Endpoints usados:
- GET /api/tickets/scanner/trips
- GET /api/tickets/scanner/active-session
- POST /api/tickets/scanner/start-session { tripId, accessCode? }
- POST /api/tickets/scanner/admin-start-session { operatorUserId, tripId, accessCode? }
- GET /api/tickets/scanner/operators (solo admin/agency admin)
- GET /api/tickets/scanner/trips/:tripId/passengers
- POST /api/tickets/verify-qr { qrPayload, presentedId?, tripId, scannerSessionId, accessCode }

Flujo:
- Activar sesion (tripId + accessCode opcional).
- Validar QR con payload completo.
- Refrescar lista de pasajeros tras validacion.

### 7.10 Intranet: operadores scanner

Endpoints usados:
- GET /api/tickets/scanner/operators
- GET /api/tickets/scanner/operator-access?operatorUserId=...
- PUT /api/tickets/scanner/operator-access { operatorUserId, tripIds[] }

## 8) Contratos usados por la UI (frontend)

### Login
Request:
```
{ "identity": "user@dominio.com", "email": "user@dominio.com", "password": "***" }
```
Response (minimo esperado):
```
{ "success": true, "token": "...", "refreshToken": "...", "user": "...", "isAdmin": false, "role": "agency", "agencyId": "", "agencyName": "", "scannerEnabled": false }
```

### Trips search
Query:
```
/api/trips?origin=Madrid&destination=Barcelona&startDate=2026-05-19&endDate=2026-05-19
```
Response:
```
{ "trips": [ { "id": 1, "routeCode": "MAD-BCN", "origin": "Madrid", "destination": "Barcelona", "departureAt": "2026-05-19 08:30:00", "arrivalAt": "2026-05-19 12:30:00", "capacity": 50, "seatsSold": 12, "basePrice": 25 } ] }
```

### Stripe checkout
Request:
```
{ "quantity": 2, "passengers": [ { "fullName": "...", "identification": "...", "phone": "...", "email": "...", "isContact": true } ], "contactEmail": "...", "tripId": 123 }
```
Response:
```
{ "success": true, "url": "https://checkout.stripe.com/...", "sessionId": "...", "orderId": 10, "referenceCode": "BJ-XXXX" }
```

### Stripe confirm
Request:
```
{ "sessionId": "cs_test_..." }
```
Response:
```
{ "success": true, "purchase": { "referenceCode": "BJ-XXXX", "contactEmail": "...", "total": 50, "currency": "EUR", "trip": { "origin": "...", "destination": "..." }, "tickets": [ { "passengerName": "...", "qrToken": "..." } ] } }
```

### Check-in lookup
Request:
```
{ "identifier": "correo@dominio.com", "referenceCode": "BJ-XXXX" }
```
Response:
```
{ "order": { "referenceCode": "BJ-XXXX", "status": "PAID", "totalAmount": 50, "currency": "EUR" }, "tickets": [ { "uuid": "...", "routeCode": "...", "origin": "...", "destination": "...", "departureAt": "...", "qrToken": "..." } ] }
```

## 9) Seguridad y estado actual

Estado actual:
- UI valida acceso por flags en localStorage.
- JWT usado para endpoints protegidos via /api.
- Refresh tokens almacenados en localStorage.

Recomendaciones para produccion:
- Pasar roles y permisos a middleware server-side.
- Rotacion de refresh tokens y blacklisting completo.
- Evitar storage de tokens en localStorage si se requiere hardening (usar cookies httpOnly).

## 10) Observabilidad y calidad

Recomendado:
- Tracking de conversion (search -> checkout -> confirm).
- Errores de API y pagos.
- Eventos de scanner y verificacion.
- Timeouts y reintentos controlados (proxy ya usa timeout).

## 11) Roadmap tecnico sugerido

- Unificar control de permisos en middleware server-side.
- Consolidar responses para UI (contratos tipados).
- E2E tests de compra, check-in y escaneo.
- Cache de catalogo (routes/trips) en BFF.