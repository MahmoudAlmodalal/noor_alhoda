"""
WSGI config for Noor Al-Huda project.
"""

import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "noor_alhuda.settings.local")
application = get_wsgi_application()
