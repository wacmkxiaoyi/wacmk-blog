from django.conf import settings
from django.db import models


class ContentViewLog(models.Model):
    RESOURCE_TYPE_ARTICLE = "article"
    RESOURCE_TYPE_BOOK = "book"
    RESOURCE_TYPES = (
        (RESOURCE_TYPE_ARTICLE, "Article"),
        (RESOURCE_TYPE_BOOK, "Book"),
    )

    resource_type = models.CharField(max_length=16, choices=RESOURCE_TYPES)
    resource_id = models.PositiveBigIntegerField()
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="content_view_logs",
    )
    visitor_key = models.CharField(max_length=64)
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "content_view_logs"
        indexes = [
            models.Index(fields=("resource_type", "resource_id", "visitor_key", "viewed_at"), name="content_view_dedupe_idx"),
            models.Index(fields=("resource_type", "viewed_at"), name="content_view_trend_idx"),
        ]
