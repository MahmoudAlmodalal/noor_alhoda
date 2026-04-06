"""
ASGI config for Noor Al-Huda project.
"""

import os
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "noor_alhuda.settings.local")
application = get_asgi_application()
