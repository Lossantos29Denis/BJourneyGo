#!/bin/sh
set -e


host="${1:-mysql}"
shift || true

echo "Esperando a MySQL en $host:3306..."

# Retry until the port is reachable. Suppress nc stderr (getaddrinfo messages)
# so logs don't fill with temporary DNS errors while Docker networking initializes.
until nc -z "$host" 3306 2>/dev/null; do
  sleep 1
done

echo "MySQL está listo!"
exec "$@"
