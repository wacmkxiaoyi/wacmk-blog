from django.apps import AppConfig


class ResourcesAccessConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.resources.access"
    label = "resources"
    verbose_name = "Resource Access"

    def ready(self):
        from .domain import evaluators  # noqa: F401
