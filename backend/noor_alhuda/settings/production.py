"""
Production settings.
"""

import dj_database_url
from decouple import config

from .base import *  # noqa: F401,F403

DEBUG = False

# Security
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Database — prefer DATABASE_URL (Render), fall back to individual vars
DATABASE_URL = config("DATABASE_URL", default="")
if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(DATABASE_URL, conn_max_age=600),
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": config("DB_NAME", default="noor_alhuda"),
            "USER": config("DB_USER", default="postgres"),
            "PASSWORD": config("DB_PASSWORD", default=""),
            "HOST": config("DB_HOST", default="localhost"),
            "PORT": config("DB_PORT", default="5432"),
        }
    }

# Django static files — use /django-static/ to avoid collision with Next.js /_next/static/
STATIC_URL = "/django-static/"

# CSRF trusted origins (required for admin behind Nginx proxy)
CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default="https://noor-alhoda.onrender.com",
    cast=lambda v: [s.strip() for s in v.split(",")],
)

# Tighten CORS in production
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="https://noor-alhoda.onrender.com",
    cast=lambda v: [s.strip() for s in v.split(",")],
)
