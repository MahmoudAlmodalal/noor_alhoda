#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-10000}"

cd /app/backend

echo "==> Running Django migrations..."
python manage.py migrate --noinput

echo "==> Creating default admin..."
python manage.py create_default_admin || echo "WARNING: admin creation skipped"

echo "==> Starting Gunicorn on 0.0.0.0:${PORT}..."
exec gunicorn noor_alhuda.wsgi:application \
    --bind 0.0.0.0:${PORT} \
    --workers 2 \
    --threads 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
