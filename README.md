# BJourneyGo

Plataforma de venta de billetes de autobus con tres aplicaciones (API, web y movil) y una capa SQL compartida.

## Proyectos incluidos

- API: [BJourneyGo-api](BJourneyGo-api)
- Web (publico + intranet): [BJourneyGo-web/BJourneyGo-web](BJourneyGo-web/BJourneyGo-web)
- Mobile (Expo/React Native): [BJourneyGo-develop/BJourneyGo-develop](BJourneyGo-develop/BJourneyGo-develop)
- SQL y migraciones: [db](db)

Documentacion tecnica adicional:
- API: [public/API.md](public/API.md)
- Web: [public/WEB.md](public/WEB.md)
- Despliegue: [DEPLOY.md](DEPLOY.md)

## Requisitos

- Node.js 18+
- npm
- MySQL 8+
- Expo Go o emulador Android/iOS (para mobile)

## Glosario y naming

Terminologia preferida en todo el repo:

- Billete: unidad de viaje asociada a un pasajero.
- Orden: compra que agrupa billetes y pago.
- Viaje: salida programada de una ruta.
- Ruta: origen/destino con duracion y distancia.
- Intranet: panel operativo interno (admin, agencia, scanner).

Roles oficiales (se mantienen con nombre tecnico):

- ADMIN: administrador global.
- AGENCY_ADMIN: administrador de agencia.
- AGENCY_WORKER: operador de agencia.
- SCANNER: operador de escaneo/validacion.

## Arquitectura (alto nivel)

```mermaid
flowchart LR
	Web[Web (Astro SSR)] -->|BFF /api| API[API (Express)]
	Mobile[Mobile (Expo)] -->|HTTP| API
	API --> DB[(MySQL)]
	API --> Uploads[/uploads]
	API --> Stripe[Stripe]
	API --> Mail[Mailjet/SMTP]
```

## Inicio rapido

Instala dependencias por proyecto:

```bash
cd BJourneyGo-api
npm install

cd ..\BJourneyGo-develop\BJourneyGo-develop
npm install

cd ..\..\BJourneyGo-web\BJourneyGo-web
npm install
```

## Variables de entorno

Cada proyecto tiene su propio archivo de ejemplo:

- API: [BJourneyGo-api/.env.example](BJourneyGo-api/.env.example)
- Web: [BJourneyGo-web/BJourneyGo-web/.env.example](BJourneyGo-web/BJourneyGo-web/.env.example)
- Mobile: [BJourneyGo-develop/BJourneyGo-develop/.env.example](BJourneyGo-develop/BJourneyGo-develop/.env.example)

Copia el archivo a .env en cada proyecto y ajusta los valores segun tu entorno.

## Desarrollo local

API:

```bash
cd BJourneyGo-api
npm run dev
```

Mobile:

```bash
cd BJourneyGo-develop\BJourneyGo-develop
npm run start
```

Web:

```bash
cd BJourneyGo-web\BJourneyGo-web
npm run dev
```

## Base de datos

El esquema inicial y las migraciones estan en:

- [db/schema_init.sql](db/schema_init.sql)
- [db/migrations](db/migrations)

Recomendado: crear la base de datos y aplicar el esquema inicial antes de levantar la API.

## Flujos clave

- Compra: busqueda de viajes -> datos de pasajeros -> pago -> emision de billetes.
- Check-in: lookup de orden por referencia + email/telefono -> validacion y descarga de QR.
- Intranet: login por rol -> gestion de viajes, billetes, usuarios y reportes.

## Flujos clave (detalle)

- Compra: web/mobile consulta viajes, crea orden, confirma pago y emite billetes con QR.
- Post-pago: guarda referencia y permite descarga de PDF/QR en Mis viajes.
- Scanner: inicia sesion, valida QR, registra verificacion y actualiza estado.

## Notas utiles

- No hay comando unico para levantar todo el monorepo; cada proyecto corre por separado.
- Si la web o mobile no cargan datos, valida que API_URL apunte al entorno correcto.

## Soporte y guias

- Guia API: [BJourneyGo-api/README.md](BJourneyGo-api/README.md)
- Guia Web: [BJourneyGo-web/BJourneyGo-web/README.md](BJourneyGo-web/BJourneyGo-web/README.md)
- Guia Mobile: [BJourneyGo-develop/BJourneyGo-develop/README.md](BJourneyGo-develop/BJourneyGo-develop/README.md)