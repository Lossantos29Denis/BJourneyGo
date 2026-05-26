# BJourneyGo API

API en Node.js + TypeScript para autenticacion, catalogo de viajes, ordenes, billetes, QR, email, pagos y operaciones administrativas.

## Stack

- Node.js + Express
- TypeScript
- MySQL (mysql2)
- JWT
- Stripe
- Resend y Nodemailer (fallback SMTP)

## Arquitectura

```mermaid
flowchart LR
	Client[Web/Mobile] -->|HTTP| Express[Express API]
	Express --> Routes[Rutas]
	Routes --> Handlers[Handlers]
	Handlers --> Services[Services]
	Services --> DB[(MySQL)]
	Services --> Stripe[Stripe]
	Services --> Mail[Resend/SMTP]
	Express --> Uploads[/uploads]
```

## Requisitos

- Node.js 18+
- npm
- MySQL 8+

## Glosario y roles

- Orden: compra que agrupa billetes y pagos.
- Billete: unidad emitida por pasajero.
- Viaje: salida programada de una ruta.

Roles oficiales:

- ADMIN
- AGENCY_ADMIN
- AGENCY_WORKER
- SCANNER

## Configuracion de entorno

Copia el ejemplo y ajusta valores:

- [BJourneyGo-api/.env.example](.env.example)

Variables minimas:

```env
DATABASE_URL="mysql://user:password@localhost:3306/bjourneygo"
JWT_SECRET="reemplaza_con_un_secreto_fuerte"
PORT=4000
WEB_URL=http://localhost:4321
```

Correo con Resend (opcional):

```env
RESEND_API_KEY=...
RESEND_FROM=no-reply@bjourneygo.me
RESEND_FROM_NAME=BJourneyGo
```

O SMTP (opcional, fallback local):

```env
SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=no-reply@bjourneygo.me
SMTP_FROM_NAME=BJourneyGo
```

Pagos (opcional):

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_SUCCESS_URL=https://www.bjourneygo.me/pago-exitoso
STRIPE_CANCEL_URL=https://www.bjourneygo.me/pago-cancelado
STRIPE_CURRENCY=EUR
```

## Instalacion

```bash
cd BJourneyGo-api
npm install
```

## Base de datos

El esquema inicial esta en [db/schema_init.sql](../db/schema_init.sql). Puedes aplicarlo manualmente:

```bash
mysql -u root -p bjourneygo < "..\db\schema_init.sql"
```

Migraciones adicionales:

- [db/migrations](../db/migrations)

## Ejecucion en desarrollo

```bash
npm run dev
```

## Ejecucion en produccion

```bash
npm run build
npm run start
```

## Flujos clave

- Registro/verify: alta de usuario y confirmacion de email.
- Compra: creacion de orden, emision de billetes y pago.
- Check-in: lookup por referencia y validacion QR.
- Intranet: operaciones admin por rol (rutas, viajes, billetes, usuarios, documentos).

## Flujos clave (detalle)

- Registro: POST /auth/register -> envio de verificacion -> /auth/verify.
- Compra: POST /orders/purchase o /payments/stripe/checkout -> confirmacion -> emision de billetes.
- Check-in: POST /checkin/lookup -> devuelve orden y billetes -> update contacto opcional.
- Scanner: /tickets/scanner/start-session -> /tickets/verify-qr -> log de verificacion.

## Scripts utiles

- `npm run check-db`: prueba de conectividad a DB.
- `npm run seed-sample-data`: datos de ejemplo.
- `npm run create-admin`: crea usuario admin.
- `npm run test-integration`: prueba end-to-end de compra.

Scripts directos (Node):

- [scripts/send-test-mail.js](scripts/send-test-mail.js): prueba de envio de email.
- [scripts/seed_sample_data.js](scripts/seed_sample_data.js): seed de datos.
- [scripts/create_admin.js](scripts/create_admin.js): crea admin.
- [scripts/test_integration_purchase.js](scripts/test_integration_purchase.js): prueba de compra.
- [scripts/apply_migration_remote.js](scripts/apply_migration_remote.js): aplica SQL remoto.
- [scripts/recreate_db_remote.js](scripts/recreate_db_remote.js): recrea DB remota.
- [scripts/check_remote_db.js](scripts/check_remote_db.js): inspecciona esquema remoto.

## Rutas utiles

- API base: http://localhost:4000
- Swagger UI: http://localhost:4000/docs
- Swagger JSON: http://localhost:4000/documentation/json

## Subidas

Los archivos subidos se sirven desde /uploads.

## Seguridad

- JWT para autenticacion y roles.
- Lista negra de access tokens en logout.
- Ventanas de verificacion QR configurables por env.

## Observabilidad

- Logs HTTP via Morgan.
- Errores de pagos y verificaciones recomendados para tracking.

## Problemas comunes

- `JWT_SECRET environment variable is required`: falta JWT_SECRET en .env.
- Error de conexion MySQL: valida DATABASE_URL, credenciales y servicio activo.
- Emails no salen: revisa variables Resend/SMTP y MAIL_DISABLED.