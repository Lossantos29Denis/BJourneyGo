# BJourneyGo

BJourneyGo is a bus ticketing platform composed of three apps and a shared SQL layer:

- **BJourneyGo-api**: Node.js + TypeScript API for authentication, trips, orders, tickets, QR validation, email, Stripe checkout, and admin operations.
- **BJourneyGo-develop**: Expo / React Native mobile app for passengers and staff.
- **BJourneyGo-web**: Astro web app for the public site and administration flows.
- **db**: initial schema and migration SQL.

The repository is organized as a multi-project workspace. Each app has its own `package.json`, `.env.example`, and runtime commands.

## Project Structure

```text
BJourneyGo/
├── BJourneyGo-api/
├── BJourneyGo-develop/
├── BJourneyGo-web/
├── db/
├── DEPLOY.md
└── README.md
```

## Main Features

- User registration and login.
- Trip search by route code, origin, or destination.
- Ticket purchase with passenger data.
- Stripe checkout flow.
- QR generation and validation for tickets.
- Admin and operations screens for trips, users, schedules, and reporting.
- Automatic trip status normalization when the arrival time has passed.

## Tech Stack

- **Backend**: Express, TypeScript, MySQL, JWT, Stripe, Nodemailer / Mailjet.
- **Mobile**: Expo, React Native, TypeScript, Expo Router.
- **Web**: Astro.
- **Database**: MySQL scripts and migrations in `db/`.

## Requirements

- Node.js 18+.
- npm.
- MySQL 8+.
- Git.
- Expo Go or an Android/iOS emulator if you want to run the mobile app locally.

## Setup

Install dependencies inside each project folder:

```bash
cd BJourneyGo-api
npm install

cd ..\BJourneyGo-develop\BJourneyGo-develop
npm install

cd ..\..\BJourneyGo-web\BJourneyGo-web
npm install
```

Each app already includes an `.env.example` file:

- `BJourneyGo-api/.env.example`
- `BJourneyGo-develop/BJourneyGo-develop/.env.example`
- `BJourneyGo-web/BJourneyGo-web/.env.example`

Copy the example file to `.env` in each folder and adjust it for your environment.

## Environment Variables

### API

The API expects, at minimum:

```env
DATABASE_URL="mysql://user:password@localhost:3306/bjourneygo"
JWT_SECRET="replace_this_with_a_strong_secret"
PORT=4000
WEB_URL=http://localhost:4321
```

Optional email and payment variables are documented in `BJourneyGo-api/.env.example`.

### Mobile

The mobile app mainly needs the public API URL:

```env
API_URL=https://api.bjourneygo.me
```

### Web

The web app also points to the API URL:

```env
API_URL=https://api.bjourneygo.me
```

## Local Development

### API

```bash
cd BJourneyGo-api
npm run dev
```

Useful API scripts:

- `npm run build`
- `npm run check-db`
- `npm run seed-sample-data`
- `npm run create-admin`
- `npm run test-integration`

### Mobile

```bash
cd BJourneyGo-develop/BJourneyGo-develop
npm run start
```

Other useful commands:

- `npm run android`
- `npm run ios`
- `npm run web`
- `npm run lint`

### Web

```bash
cd BJourneyGo-web/BJourneyGo-web
npm run dev
```

Other useful commands:

- `npm run build`
- `npm run preview`

## Database

The `db/` folder contains the initial schema and migrations used by the project.

- `db/schema_init.sql`
- `db/migrations/`

If you are starting from zero, create the MySQL database first and then apply the schema or migrations according to the API instructions.

## Important Notes

- There is no single root app command for all projects; each subproject runs independently.
- Keep secrets out of git. The repository uses `.gitignore` files for each app and a root `.gitignore` for shared exclusions.
- If Git asks for credentials, use the account that has access to the repository.
- For deployment instructions, use `DEPLOY.md`.

## Troubleshooting

- If the API cannot connect to MySQL, verify `DATABASE_URL`, the database name, and that the MySQL service is running.
- If the mobile app cannot load trips, confirm `API_URL` points to the correct public API.
- If the web app fails to start, verify that its own dependencies are installed inside `BJourneyGo-web/BJourneyGo-web`.

## Reference Files

- API setup: `BJourneyGo-api/README.md`
- Web setup: `BJourneyGo-web/BJourneyGo-web/README.md`
- API environment example: `BJourneyGo-api/.env.example`
- Mobile environment example: `BJourneyGo-develop/BJourneyGo-develop/.env.example`
- Web environment example: `BJourneyGo-web/BJourneyGo-web/.env.example`
- Deployment guide: `DEPLOY.md`
