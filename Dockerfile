# ============================================================
# Stage 1: Build Next.js frontend
# ============================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Install dependencies first (cache layer)
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy source and build
COPY frontend/ ./

# Empty string = all API calls use relative paths (same origin)
ENV NEXT_PUBLIC_API_URL=""

RUN npm run build

# ============================================================
# Stage 2: Final runtime image
# ============================================================
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=noor_alhuda.settings.production

WORKDIR /app

# ── System dependencies ──────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev nginx curl gettext-base \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── Python dependencies ──────────────────────────────────────
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# ── Copy backend source ──────────────────────────────────────
COPY backend/ ./backend/

# ── Collect Django static files at build time ─────────────────
RUN cd backend && python manage.py collectstatic --noinput

# ── Copy Next.js standalone build from Stage 1 ───────────────
COPY --from=frontend-builder /app/frontend/.next/standalone ./frontend/
COPY --from=frontend-builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder /app/frontend/public ./frontend/public

# ── Copy Nginx config and startup script ──────────────────────
COPY nginx.conf /etc/nginx/nginx.conf.template
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 10000

CMD ["/app/start.sh"]
