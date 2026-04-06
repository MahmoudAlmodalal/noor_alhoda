"""
Local development settings.
"""

from .base import *  # noqa: F401,F403

DEBUG = True

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",  # noqa: F405
    }
}

# Allow all origins in dev
CORS_ALLOW_ALL_ORIGINS = True

# Disable whitenoise caching in dev
STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"
