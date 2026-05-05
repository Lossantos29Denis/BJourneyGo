# BJourneyGo deployment guide (Ubuntu + Caddy)

This guide prepares the web (Astro), API (Node/TS), and local DB on the same server. Mobile connects from extranet via the public API domain.

## 1) Server prerequisites
- Ubuntu server with public IP
- Node 18+ installed
- MySQL 8+ installed locally
- Caddy installed and running

## 2) DNS and domains
Recommended:
- Web: https://www.bjourneygo.me
- API: https://api.bjourneygo.me

## 3) Caddyfile
Place this at /etc/caddy/Caddyfile:

```
www.bjourneygo.me {
  @legacyScripts path_regexp legacy ^/src/pages/scripts/(.*)$
  redir @legacyScripts /src/scripts/{re.legacy.1} 308

  reverse_proxy 127.0.0.1:3000
}

bjourneygo.me {
  redir https://www.bjourneygo.me{uri}
}

api.bjourneygo.me {
  reverse_proxy 127.0.0.1:4000
}
```

This keeps backward compatibility if any old HTML/browser cache still requests `/src/pages/scripts/*`.

Reload:
```
sudo systemctl reload caddy
```

## 4) API deployment (BJourneyGo-api)
### 4.1 Install
```
cd /opt/BJourneyGo/BJourneyGo-api
npm install
npm run build
```

### 4.2 Environment
Create /opt/BJourneyGo/BJourneyGo-api/.env with:

```
DATABASE_URL="mysql://bjourneygo_api:YOUR_PASSWORD@localhost:3306/bjourneygo"
JWT_SECRET=YOUR_LONG_SECRET
PORT=4000

# SMTP (optional)
SMTP_HOST=smtp.mailersend.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=YOUR_SMTP_USER
SMTP_PASS=YOUR_SMTP_PASS
SMTP_FROM="BJourneyGo <MS_MtLNkv@bjourneygo.me>"
MAIL_DISABLED=true

API_URL=https://api.bjourneygo.me
WEB_URL=https://www.bjourneygo.me

EMAIL_LOGO_URL=https://www.bjourneygo.me/bJourneyGO4%20(1).png
EMAIL_BRAND_NAME=BJourneyGo
EMAIL_BRAND_COLOR=#F5C542
SUPPORT_EMAIL=support@bjourneygo.me
```

### 4.3 Systemd service
Create /etc/systemd/system/bjourneygo-api.service:

```
[Unit]
Description=BJourneyGo API
After=network.target

[Service]
WorkingDirectory=/opt/BJourneyGo/BJourneyGo-api
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```
sudo systemctl daemon-reload
sudo systemctl enable bjourneygo-api
sudo systemctl start bjourneygo-api
```

## 5) Web deployment (BJourneyGo-web)
### 5.1 Build
```
cd /opt/BJourneyGo/BJourneyGo-web/BJourneyGo-web
npm install
npm run build
```

### 5.2 Run (Astro Node adapter)
For the node adapter in standalone mode, run:

```
node ./dist/server/entry.mjs
```

If your build produces a different entry file, use the file in dist/server/.

### 5.3 Systemd service
Create /etc/systemd/system/bjourneygo-web.service:

```
[Unit]
Description=BJourneyGo Web
After=network.target

[Service]
WorkingDirectory=/opt/BJourneyGo/BJourneyGo-web/BJourneyGo-web
ExecStart=/usr/bin/node ./dist/server/entry.mjs
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=API_URL=https://api.bjourneygo.me

[Install]
WantedBy=multi-user.target
```

Enable and start:
```
sudo systemctl daemon-reload
sudo systemctl enable bjourneygo-web
sudo systemctl start bjourneygo-web
```

## 6) Database (local)
- Create the DB locally on the server and apply schema/migrations.
- Use the same DATABASE_URL in the API .env.

## 7) Mobile (extranet)
- App uses API_URL from environment:
  - https://api.bjourneygo.me
- Ensure SSL is valid and API is reachable from the public internet.

## 8) Quick checks
```
# Web and API should return HTTP 200
curl -I https://www.bjourneygo.me
curl -I https://api.bjourneygo.me/health
```
