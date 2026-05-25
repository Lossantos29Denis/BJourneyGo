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

## 12) Inventario de archivos (Web)

Raiz:
- .dockerignore: exclusiones Docker (node_modules, dist, git, data).
- .env.example: plantilla de entorno con API_URL.
- .gitignore: archivos y carpetas ignoradas por Git.
- astro.config.mjs: configuracion Astro con adapter Node y ajustes Vite.
- Dockerfile: contenedor para deploy SSR.
- package.json: dependencias y scripts de build/dev.
- README.md: documentacion base del proyecto.
- ROLES-SYSTEM-DOCUMENTATION.js: documentacion de roles y estructura localStorage.
- tsconfig.json: TypeScript strict extendido de Astro.

data:
- data/users.json: usuarios de prueba con roles y credenciales mock.

public (assets estaticos):
- public/favicon.svg: favicon del sitio.
- public/logo.svg: logo vectorial.
- public/social-card.svg: imagen de social preview.
- public/bJourneyGO4 (1).png: imagen de marketing.
- public/Incremento.png: logo de partner.
- public/login_background.jpg: fondo de login.
- public/flags/be.svg: bandera de Belgica.
- public/flags/de.svg: bandera de Alemania.
- public/flags/es.svg: bandera de Espana.
- public/flags/fr.svg: bandera de Francia.
- public/flags/gb.svg: bandera de Reino Unido.
- public/flags/it.svg: bandera de Italia.
- public/flags/nl.svg: bandera de Paises Bajos.
- public/flags/pl.svg: bandera de Polonia.
- public/flags/pt.svg: bandera de Portugal.
- public/flags/us.svg: bandera de Estados Unidos.

public/src/scripts (JS cliente):
- public/src/scripts/api.js: helpers HTTP y refresh automatico.
- public/src/scripts/landing.js: interacciones de landing.
- public/src/scripts/login.js: envio de login y estado de sesion.
- public/src/scripts/register.js: registro de usuarios.
- public/src/scripts/verify.js: verificacion de email.
- public/src/scripts/olvide-contrasena.js: solicitud de reset.
- public/src/scripts/restablecer-contrasena.js: formulario de reset.
- public/src/scripts/comprar.js: busqueda y seleccion de viajes.
- public/src/scripts/comprar-pasajeros.js: captura de pasajeros y checkout.
- public/src/scripts/cambiar-viaje.js: flujo de cambio de viaje.
- public/src/scripts/checkin.js: lookup y actualizacion de contacto.
- public/src/scripts/mis-viajes.js: listado de ordenes, PDF y QR.
- public/src/scripts/pago-exitoso.js: confirmacion de pago.
- public/src/scripts/configuracion.js: configuracion intranet.
- public/src/scripts/documentos-publicos.js: acceso a documentos publicos.
- public/src/scripts/estadisticas.js: dashboard de estadisticas.
- public/src/scripts/gestion-billetes.js: gestion de billetes.
- public/src/scripts/gestion-usuarios.js: gestion de usuarios.
- public/src/scripts/gestion-agencias.js: gestion de agencias.
- public/src/scripts/intranet-login.js: login intranet.
- public/src/scripts/intranet-panel.js: panel intranet.
- public/src/scripts/intranet-agencias.js: intranet de agencias.
- public/src/scripts/intranet-calendario-turnos.js: calendario y turnos.
- public/src/scripts/intranet-config.js: configuracion intranet.
- public/src/scripts/intranet-documentos.js: documentos intranet.
- public/src/scripts/intranet-escaner-qr.js: escaner QR.
- public/src/scripts/intranet-operadores-scanner.js: operadores de scanner.

public/src/pages/api (copias para hosting estatico):
- public/src/pages/api/login.js: proxy login.
- public/src/pages/api/logout.js: proxy logout.
- public/src/pages/api/me.js: proxy perfil.
- public/src/pages/api/refresh.js: proxy refresh.
- public/src/pages/api/register.js: proxy registro.
- public/src/pages/api/resend-verify.js: proxy resend verify.
- public/src/pages/api/verify.js: proxy verify.
- public/src/pages/api/verify-status.js: proxy verify status.
- public/src/pages/api/verify-code.post.ts: proxy verify code.
- public/src/pages/api/send-verification.post.ts: proxy envio verificacion.
- public/src/pages/api/verificationStore.js: storage de verificacion.
- public/src/pages/api/delete-user.js: proxy delete-user.
- public/src/pages/api/update-user.js: proxy update-user.
- public/src/pages/api/sync-user.js: proxy sync-user.
- public/src/pages/api/trips.js: proxy trips.
- public/src/pages/api/routes.js: proxy rutas.
- public/src/pages/api/documents.js: proxy documentos.
- public/src/pages/api/stripe/checkout.js: proxy stripe checkout.
- public/src/pages/api/stripe/confirm.js: proxy stripe confirm.
- public/src/pages/api/admin/agencies.js: proxy admin agencias.
- public/src/pages/api/admin/buses.js: proxy admin buses.
- public/src/pages/api/admin/calendar-events.js: proxy admin calendar events.
- public/src/pages/api/admin/config.js: proxy admin config.
- public/src/pages/api/admin/documents.js: proxy admin documents.
- public/src/pages/api/admin/email-verifications.js: proxy admin email verifications.
- public/src/pages/api/admin/routes.js: proxy admin routes.
- public/src/pages/api/admin/shift-users.js: proxy admin shift users.
- public/src/pages/api/admin/shifts.js: proxy admin shifts.
- public/src/pages/api/admin/stats.js: proxy admin stats.
- public/src/pages/api/admin/trips.js: proxy admin trips.
- public/src/pages/api/admin/users.js: proxy admin users.

src/assets:
- src/assets/astro.svg: logo de Astro.
- src/assets/background.svg: fondo vectorial.
- src/assets/bjournet.png: imagen de marca.
- src/assets/bjournet-removebg-preview.png: logo sin fondo.
- src/assets/Incremento.png: logo de partner.

src/components:
- src/components/Welcome.astro: componente de bienvenida.

src/layouts:
- src/layouts/Layout.astro: layout general del sitio.
- src/layouts/AuthLayout.astro: layout de autenticacion.

src/pages (rutas Astro):
- src/pages/index.astro: home principal.
- src/pages/landing.astro: landing de marketing.
- src/pages/inicio.astro: pagina de inicio alternativa.
- src/pages/comprar.astro: busqueda de viajes.
- src/pages/comprar-pasajeros.astro: formulario de pasajeros y pago.
- src/pages/pago-exitoso.astro: confirmacion de pago.
- src/pages/pago-cancelado.astro: pago cancelado.
- src/pages/compra-prueba-exitosa.astro: confirmacion de compra de prueba.
- src/pages/checkin.astro: check-in publico.
- src/pages/login.astro: login web.
- src/pages/register.astro: registro.
- src/pages/verify.astro: verificacion de email.
- src/pages/olvide-contrasena.astro: solicitud de reset.
- src/pages/restablecer-contrasena.astro: formulario de reset.
- src/pages/mis-viajes.astro: listado de viajes del usuario.
- src/pages/intranet-login.astro: login intranet.
- src/pages/intranet.astro: panel intranet.
- src/pages/estadisticas.astro: dashboard de estadisticas.
- src/pages/gestion-usuarios.astro: gestion de usuarios.
- src/pages/gestion-billetes.astro: gestion de billetes.
- src/pages/documentos.astro: documentos publicos.
- src/pages/configuracion.astro: configuracion intranet.
- src/pages/admin.astro: panel admin general.
- src/pages/intranet/agencias.astro: gestion de agencias.
- src/pages/intranet/operadores-scanner.astro: operadores scanner.
- src/pages/intranet/escaner-qr.astro: escaner QR.
- src/pages/intranet/documentos.astro: documentos intranet.
- src/pages/intranet/configuracion.astro: configuracion intranet.
- src/pages/intranet/calendario-turnos.astro: calendario de turnos.
- src/pages/mis-viajes/cambiar/[uuid].astro: cambio de viaje por ticket.
- src/pages/uploads/[...path].js: proxy de archivos /uploads.

src/pages/api (BFF/proxy):
- src/pages/api/_lib/proxy.js: utilidades de proxy (JSON/stream/formdata).
- src/pages/api/login.js: proxy login.
- src/pages/api/logout.js: proxy logout.
- src/pages/api/me.js: proxy perfil.
- src/pages/api/refresh.js: proxy refresh.
- src/pages/api/register.js: proxy registro.
- src/pages/api/resend-verify.js: proxy resend verify.
- src/pages/api/verify.js: proxy verify.
- src/pages/api/verify-status.js: proxy verify status.
- src/pages/api/verify-code.post.ts: proxy verify code.
- src/pages/api/send-verification.post.ts: proxy envio verificacion.
- src/pages/api/verificationStore.js: storage de verificacion.
- src/pages/api/auth/send-reset.js: proxy envio de reset.
- src/pages/api/auth/reset.js: proxy reset de contrasena.
- src/pages/api/delete-user.js: proxy delete-user.
- src/pages/api/update-user.js: proxy update user.
- src/pages/api/sync-user.js: proxy sync user.
- src/pages/api/trips.js: proxy trips.
- src/pages/api/routes.js: proxy rutas.
- src/pages/api/documents.js: proxy documentos.
- src/pages/api/contact.js: proxy contacto.
- src/pages/api/checkin/lookup.js: proxy lookup check-in.
- src/pages/api/checkin/update-contact.js: proxy update contact.
- src/pages/api/orders/my.js: proxy mis ordenes.
- src/pages/api/orders/tickets/[uuid]/alternatives.js: proxy alternativas de cambio.
- src/pages/api/orders/tickets/[uuid]/change-trip.js: proxy cambio de trip.
- src/pages/api/orders/tickets/[uuid]/change-trip-checkout.js: proxy checkout de cambio.
- src/pages/api/orders/tickets/[uuid]/refund-request.js: proxy solicitud de reembolso.
- src/pages/api/payments/test-purchase.js: proxy compra de prueba.
- src/pages/api/stripe/checkout.js: proxy stripe checkout.
- src/pages/api/stripe/confirm.js: proxy stripe confirm.
- src/pages/api/tickets/[uuid]/pdf.js: proxy PDF de ticket.
- src/pages/api/tickets/verify-qr.js: proxy verificacion QR.
- src/pages/api/tickets/scanner/active-session.js: proxy sesion activa.
- src/pages/api/tickets/scanner/admin-start-session.js: proxy iniciar sesion admin.
- src/pages/api/tickets/scanner/start-session.js: proxy iniciar sesion.
- src/pages/api/tickets/scanner/operators.js: proxy operadores scanner.
- src/pages/api/tickets/scanner/operator-access.js: proxy accesos operador.
- src/pages/api/tickets/scanner/trips.js: proxy trips scanner.
- src/pages/api/tickets/scanner/trips/[tripId]/passengers.js: proxy pasajeros por trip.
- src/pages/api/uploads/[...path].js: proxy de archivos /uploads.
- src/pages/api/admin/agencies.js: proxy admin agencias.
- src/pages/api/admin/buses.js: proxy admin buses.
- src/pages/api/admin/calendar-events.js: proxy admin calendar events.
- src/pages/api/admin/config.js: proxy admin config.
- src/pages/api/admin/documents.js: proxy admin documentos.
- src/pages/api/admin/documents/upload.js: proxy upload documento.
- src/pages/api/admin/documents/[id].js: proxy documento por id.
- src/pages/api/admin/email-verifications.js: proxy admin email verifications.
- src/pages/api/admin/routes.js: proxy admin routes.
- src/pages/api/admin/routes/[id].js: proxy route por id.
- src/pages/api/admin/shift-users.js: proxy admin shift users.
- src/pages/api/admin/shifts.js: proxy admin shifts.
- src/pages/api/admin/stats.js: proxy admin stats.
- src/pages/api/admin/trips.js: proxy admin trips.
- src/pages/api/admin/trips/[id].js: proxy trip por id.
- src/pages/api/admin/users.js: proxy admin users.

src/styles:
- src/styles/landing.css: estilos de landing.
- src/styles/login.css: estilos de login.
- src/styles/register.css: estilos de registro.
- src/styles/verify.css: estilos de verificacion.
- src/styles/comprar.css: estilos de compra.
- src/styles/comprar-pasajeros.css: estilos de pasajeros.
- src/styles/cambiar-viaje.css: estilos de cambio de viaje.
- src/styles/checkout.css: estilos de checkout.
- src/styles/checkin.css: estilos de check-in.
- src/styles/mis-viajes.css: estilos de mis viajes.
- src/styles/configuracion.css: estilos de configuracion.
- src/styles/gestion-usuarios.css: estilos de gestion de usuarios.
- src/styles/gestion-agencias.css: estilos de gestion de agencias.
- src/styles/intranet-login.css: estilos de login intranet.
- src/styles/intranet-config.css: estilos de config intranet.
- src/styles/intranet-documentos.css: estilos de documentos intranet.
- src/styles/intranet-calendario-turnos.css: estilos de calendario.
- src/styles/intranet-escaner-qr.css: estilos de escaner QR.
- src/styles/intranet-operadores-scanner.css: estilos de operadores scanner.