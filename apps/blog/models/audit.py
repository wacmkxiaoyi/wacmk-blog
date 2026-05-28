from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from .base import TimeStampedModel


class ContentViewLog(TimeStampedModel):
    CONTENT_TYPE_POST = "post"
    CONTENT_TYPE_BOOK = "book"
    CONTENT_TYPE_CHOICES = [
        (CONTENT_TYPE_POST, _("Post")),
        (CONTENT_TYPE_BOOK, _("Book")),
    ]

    content_type = models.CharField(max_length=16, choices=CONTENT_TYPE_CHOICES)
    object_id = models.PositiveBigIntegerField()
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="content_view_logs",
    )
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    session_key = models.CharField(max_length=40, blank=True)
    viewed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-viewed_at", "-pk"]
        indexes = [
            models.Index(fields=["content_type", "object_id", "viewed_at"]),
            models.Index(fields=["content_type", "viewed_at"]),
            models.Index(fields=["user", "viewed_at"]),
            models.Index(fields=["ip_address", "viewed_at"]),
            models.Index(fields=["session_key", "viewed_at"]),
        ]

    def __str__(self):
        return f"{self.content_type}:{self.object_id} @ {self.viewed_at:%Y-%m-%d %H:%M:%S}"


class AuditLog(TimeStampedModel):
    ACTION_LOGIN = "login"
    ACTION_LOGOUT = "logout"
    ACTION_POST_CREATE = "post_create"
    ACTION_POST_UPDATE = "post_update"
    ACTION_POST_DELETE = "post_delete"
    ACTION_COMMENT_CREATE = "comment_create"
    ACTION_COMMENT_UPDATE = "comment_update"
    ACTION_COMMENT_DELETE = "comment_delete"
    ACTION_PROFILE_UPDATE = "profile_update"
    ACTION_USER_UPDATE = "user_update"
    ACTION_USER_DELETE = "user_delete"
    ACTION_USER_ASSET_UPDATE = "user_asset_update"
    ACTION_CHOICES = [
        (ACTION_LOGIN, _("Login")),
        (ACTION_LOGOUT, _("Logout")),
        (ACTION_POST_CREATE, _("Create post")),
        (ACTION_POST_UPDATE, _("Update post")),
        (ACTION_POST_DELETE, _("Delete post")),
        (ACTION_COMMENT_CREATE, _("Create comment")),
        (ACTION_COMMENT_UPDATE, _("Update comment")),
        (ACTION_COMMENT_DELETE, _("Delete comment")),
        (ACTION_PROFILE_UPDATE, _("Update profile")),
        (ACTION_USER_UPDATE, _("Update user")),
        (ACTION_USER_DELETE, _("Delete user")),
        (ACTION_USER_ASSET_UPDATE, _("Update user assets")),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=32, choices=ACTION_CHOICES)
    message = models.CharField(max_length=255)
    ip_address = models.GenericIPAddressField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["action", "created_at"])]

    def __str__(self):
        return f"{self.get_action_display()}: {self.message}"
