from django.apps import AppConfig


class ResourcesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.resources"

    def ready(self):
        from .access.domain import evaluators  # noqa: F401
        from .access.infrastructure.repositories import ResourceRepository

        ResourceRepository.register("article", "resources.Article")
        ResourceRepository.register("book", "resources.Book")
        ResourceRepository.register("attachment", "resources.Attachment")
