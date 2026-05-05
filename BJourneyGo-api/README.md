# BJourneyGo API — Setup y ejecución

Este README explica cómo preparar y ejecutar la API localmente, con Prisma y opciones para aplicar el SQL inicial.

Requisitos
- Node.js (v18+ recomendado)
- NPM
- MySQL 8+ (o compatible)

1) Variables de entorno

Crea un archivo `.env` en la raíz de `BJourneyGo-api` con estas variables (ajusta según tu entorno):

```
DATABASE_URL="mysql://dbuser:dbpass@localhost:3306/BJourneyGo"
JWT_SECRET="un-secreto-largo-y-random"
PORT=4000
```

Si quieres enviar correos (verificación, restablecer contraseña) añade estas variables SMTP (MailerSend recomendado):

```
SMTP_HOST=smtp.mailersend.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=smtp_your_user
SMTP_PASS=your-smtp-password
SMTP_FROM="BJourneyGo <no-reply@bjourneygo.com>"
SMTP_FROM_NAME="BJourneyGo"
```

Para otros proveedores SMTP, ajusta host/puerto/secure según la documentación.

Notas:
- `JWT_SECRET` es obligatorio.
- Si la BD no existe, `prisma migrate` puede crearla si el usuario tiene permisos, o crea la DB manualmente.

2) Instalar dependencias y generar cliente Prisma

```bash
cd "C:/Users/denis/Desktop/BJourneyGo/BJourneyGo-api"
npm install
npx prisma generate
```

3) Migraciones

Opción A — Migraciones Prisma (recomendado durante desarrollo):

```bash
npx prisma migrate dev --name init
```

Opción B — Aplicar SQL manualmente (usa si no quieres migraciones Prisma ahora):

```bash
# desde Powershell, ajusta la ruta si hace falta
mysql -u root -p BJourneyGo < "..\db\schema_init.sql"
```

4) Arrancar la API en desarrollo

```bash
npm run dev
```

9) Probar envío de email (test)

Para verificar que tu configuración SMTP funciona, copia `.env.example` a `.env` y rellena `SMTP_USER` y `SMTP_PASS` (App Password para Gmail). Luego ejecuta el script de prueba:

```bash
# en la carpeta BJourneyGo-api
node scripts/send-test-mail.js
```

Si la cuenta está correctamente configurada verás `Message sent:` y si se usó Ethereal también un `Preview URL:` para inspeccionar el correo.


Rutas útiles tras arrancar:
- API base: http://localhost:4000
- Swagger UI: http://localhost:4000/docs
- Swagger JSON: http://localhost:4000/documentation/json

5) Ejecutar en producción

```bash
npm run build
NODE_ENV=production PORT=4000 JWT_SECRET="tu-secret" node dist/index.js
```

6) Comandos Windows (PowerShell) para variables temporales

```powershell
$env:DATABASE_URL = "mysql://dbuser:dbpass@localhost:3306/BJourneyGo"
$env:JWT_SECRET = "un-secreto-largo-y-random"
$env:PORT = "4000"
npm run dev
```

7) Problemas comunes y soluciones rápidas
- Error: `JWT_SECRET environment variable is required` → asegúrate que `.env` exista y contenga `JWT_SECRET`.
- Errores de migración por permisos → crea la BD manualmente o ejecuta SQL con un usuario con permisos.
- Conn. MySQL rechazada → verifica host/port/credenciales y que el servicio MySQL esté activo.

8) Siguientes pasos sugeridos
- Ejecutar `npx prisma migrate dev` para crear las tablas y `npx prisma generate` para actualizar el cliente.
- Poblar `User`/`Agency` de prueba (seed) y probar login `/auth/login` desde la UI.

9) Mailjet (opcional)

Si quieres usar Mailjet para enviar correos transaccionales (verificación, reseteo, recibos) en lugar de SMTP:

- Variables de entorno necesarias:

```
MAILJET_API_KEY=your_mailjet_key
MAILJET_API_SECRET=your_mailjet_secret
MAILJET_FROM_EMAIL=no-reply@bjourneygo.com
MAILJET_FROM_NAME="BJourneyGo"
```

El mailer en `src/lib/mailer.ts` usa Mailjet cuando están las credenciales; si faltan, intenta SMTP. Si no hay ninguno configurado, se suprime el envío y se registra una advertencia.

10) Migraciones y cambios SQL adicionales

Hicimos cambios en el esquema `Ticket` (nuevas columnas `uuid`, `issued_at`, `created_at`, `updated_at`) y creamos una migración SQL en `db/migrations/alter_ticket_add_timestamps.sql`.

Para aplicar migraciones manualmente a un servidor remoto sin acceso directo a `mysql` en este entorno, hay scripts en `scripts/`:

- `scripts/apply_migration_remote.js` — intenta aplicar un archivo SQL remoto usando la conexión provista.
- `scripts/recreate_db_remote.js` — recrea la base de datos remota a partir de `db/schema_init.sql`.
- `scripts/check_remote_db.js` — comprueba la estructura (columns, triggers) de `Ticket` en la DB remota.

Si tu servidor MySQL tiene `log_bin` habilitado, la creación de triggers puede requerir `SUPER` o `log_bin_trust_function_creators=1`. En ese caso puedes:

- Pedir al administrador que habilite `log_bin_trust_function_creators` o que aplique el trigger por ti.
- Ofiusar el trigger; la aplicación ahora genera `uuid` y `issued_at` desde el lado de la app.

11) Script de integración (pruebas básicas)

Hay un script de integración que simula: seed de datos, registro de usuario, login, compra de billete y reconciliación de pago:

```
node scripts/test_integration_purchase.js
```

Añade en `.env` la variable `API_URL` si tu servidor no está en `http://localhost:4000`.

12) Próximos pasos que puedo implementar

- Rotación de `JWT_SECRET` y gestión de revocación de access tokens.
- Generación de recibos PDF adjuntos a los emails.
- Pruebas automatizadas más completas.

Si quieres que aplique alguno de estos, dime cuál y lo implemento.

Si quieres, puedo:
- (A) ejecutar los comandos de instalación y generación aquí (requiere acceso a tu DB desde este entorno), o
- (B) crear un script `npm run seed` con datos de ejemplo para `User`/`Agency`.

---
Archivo añadido: [BJourneyGo-api/README.md](BJourneyGo-api/README.md)
# BJourneyGo API (scaffold)

Minimal scaffold for the BJourneyGo API using Fastify + TypeScript + Prisma (MySQL).

Quick start

1. Copy `.env.example` to `.env` and set `DATABASE_URL` and `JWT_SECRET`.
2. Install:

```bash
npm install
```

3. Generate Prisma client and run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

4. Run in dev:

```bash
npm run dev
```
