FROM node:18

# Install netcat for the wait-for-mysql script to probe TCP ports
RUN apt-get update \
	&& apt-get install -y --no-install-recommends netcat-openbsd \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Install only dependencies first for caching
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Ensure ts-node-dev binary is executable inside the image (harmless if missing)
RUN if [ -f node_modules/.bin/ts-node-dev ]; then chmod +x node_modules/.bin/ts-node-dev; fi

# Copy app source
COPY . .

# Ensure wait-for-mysql.sh is executable inside the image
RUN if [ -f /usr/src/app/wait-for-mysql.sh ]; then chmod +x /usr/src/app/wait-for-mysql.sh; fi

EXPOSE 4000

# Ensure ts-node-dev is executable at container start (helps when host mounts hide exec bits)
# Run wait-for-mysql.sh with sh so the script is not executed by Node.
CMD ["sh", "-c", "chmod +x node_modules/.bin/ts-node-dev 2>/dev/null || true; /usr/src/app/wait-for-mysql.sh mysql && npm run dev"]
