# Guía de despliegue de BJourneyGo (Ubuntu + Caddy)

Esta guía prepara la web (Astro), la API (Node/TS) y la base de datos local en el mismo servidor. Sustituye cada dominio, usuario, contraseña y correo de ejemplo por tus valores reales antes de desplegar.

## 1) Requisitos del servidor
- Servidor Ubuntu con IP pública
- Node 18+ instalado
- MySQL 8+ instalado localmente
- Caddy instalado y en ejecución

## 2) DNS y dominios
Valores de ejemplo:
- Web: https://www.tu-dominio.com
- API: https://api.tu-dominio.com

## 3) Caddyfile
Coloca esto en /etc/caddy/Caddyfile:

```
www.tu-dominio.com {
  @legacyScripts path_regexp legacy ^/src/pages/scripts/(.*)$
  redir @legacyScripts /src/scripts/{re.legacy.1} 308

  reverse_proxy 127.0.0.1:3000
}

tu-dominio.com {
  redir https://www.tu-dominio.com{uri}
}

api.tu-dominio.com {
  reverse_proxy 127.0.0.1:4000
}
```

Esto mantiene compatibilidad si todavía existe alguna caché antigua de HTML o navegador que pida /src/pages/scripts/*.

Recarga:
```
sudo systemctl reload caddy
```

## 4) Despliegue de la API (BJourneyGo-api)
### 4.1 Instalación
```
cd /opt/BJourneyGo/BJourneyGo-api
npm install
npm run build
```

### 4.2 Variables de entorno
Crea /opt/BJourneyGo/BJourneyGo-api/.env con solo valores de ejemplo:

```
DATABASE_URL="mysql://api_user:YOUR_DB_PASSWORD@localhost:3306/bjourneygo"
JWT_SECRET=YOUR_LONG_RANDOM_SECRET
PORT=4000

# SMTP (opcional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=YOUR_SMTP_USER
SMTP_PASS=YOUR_SMTP_PASSWORD
SMTP_FROM="BJourneyGo <no-reply@tu-dominio.com>"
MAIL_DISABLED=true

API_URL=https://api.tu-dominio.com
WEB_URL=https://www.tu-dominio.com

EMAIL_LOGO_URL=https://www.tu-dominio.com/assets/email-logo.png
EMAIL_BRAND_NAME=BJourneyGo
EMAIL_BRAND_COLOR=#F5C542
SUPPORT_EMAIL=support@tu-dominio.com
```

### 4.3 Servicio systemd
Crea /etc/systemd/system/bjourneygo-api.service:

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

Habilita y arranca:
```
sudo systemctl daemon-reload
sudo systemctl enable bjourneygo-api
sudo systemctl start bjourneygo-api
```

## 5) Despliegue de la web (BJourneyGo-web)
### 5.1 Compilación
```
cd /opt/BJourneyGo/BJourneyGo-web/BJourneyGo-web
npm install
npm run build
```

### 5.2 Ejecución (adaptador Node de Astro)
Para el adaptador Node en modo standalone, ejecuta:

```
node ./dist/server/entry.mjs
```

Si tu compilación produce un archivo de entrada distinto, usa el archivo dentro de dist/server/.

### 5.3 Servicio systemd
Crea /etc/systemd/system/bjourneygo-web.service:

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
Environment=API_URL=https://api.tu-dominio.com

[Install]
WantedBy=multi-user.target
```

Habilita y arranca:
```
sudo systemctl daemon-reload
sudo systemctl enable bjourneygo-web
sudo systemctl start bjourneygo-web
```

## 6) Base de datos local
- Crea la base de datos localmente en el servidor y aplica el esquema y las migraciones.
- Usa la misma DATABASE_URL en el .env de la API.

## 7) Móvil (extranet)
- La app usa API_URL desde variables de entorno, por ejemplo https://api.tu-dominio.com
- Asegúrate de que el SSL sea válido y de que la API sea accesible desde Internet.

## 8) Comprobaciones rápidas
```
# La web y la API deberían responder HTTP 200
curl -I https://www.tu-dominio.com
curl -I https://api.tu-dominio.com/health
```

## 9) Notas de seguridad
- No guardes contraseñas reales, tokens, correos privados ni URLs internas en este archivo.
- Para valores de producción, usa variables de entorno y un gestor de secretos.
