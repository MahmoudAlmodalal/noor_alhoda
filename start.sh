#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-10000}"

echo "==> Running Django migrations..."
cd /app/backend
python manage.py migrate --noinput

echo "==> Creating default admin (0590000000)..."
python manage.py create_default_admin

echo "==> Starting Gunicorn on 127.0.0.1:8000..."
cd /app/backend
gunicorn noor_alhuda.wsgi:application \
    --bind 127.0.0.1:8000 \
    --workers 2 \
    --threads 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - &
GUNICORN_PID=$!

echo "==> Starting Next.js on 127.0.0.1:3000..."
cd /app/frontend
HOSTNAME=127.0.0.1 PORT=3000 node server.js &
NEXT_PID=$!

echo "==> Configuring Nginx on port ${PORT}..."
export PORT
envsubst '${PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

echo "==> Starting Nginx (foreground)..."
nginx -g "daemon off;" &
NGINX_PID=$!

# If any process dies, kill all and exit
trap "kill $GUNICORN_PID $NEXT_PID $NGINX_PID 2>/dev/null; exit 1" EXIT

wait -n $GUNICORN_PID $NEXT_PID $NGINX_PID
echo "ERROR: A process exited unexpectedly!"
exit 1
