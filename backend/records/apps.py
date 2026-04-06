from django.apps import AppConfig


class RecordsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "records"
    verbose_name = "السجلات"

    def ready(self):
        import backend.records.signals  # noqa: F401
