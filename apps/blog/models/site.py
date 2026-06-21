from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from .base import TimeStampedModel


class SiteSetting(TimeStampedModel):
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = _("Site setting")
        verbose_name_plural = _("Site settings")
        ordering = ["key"]

    def __str__(self):
        return self.key


class MediaCleanupJob(TimeStampedModel):
    STATUS_PENDING = "pending"
    STATUS_RUNNING = "running"
    STATUS_SUCCEEDED = "succeeded"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, _("Pending")),
        (STATUS_RUNNING, _("Running")),
        (STATUS_SUCCEEDED, _("Succeeded")),
        (STATUS_FAILED, _("Failed")),
    ]

    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="requested_media_cleanup_jobs")
    started_at = models.DateTimeField(blank=True, null=True)
    finished_at = models.DateTimeField(blank=True, null=True)
    scanned_file_count = models.PositiveIntegerField(default=0)
    kept_file_count = models.PositiveIntegerField(default=0)
    deleted_file_count = models.PositiveIntegerField(default=0)
    deleted_directory_count = models.PositiveIntegerField(default=0)
    referenced_path_count = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True, default="")
    result_summary = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at", "-pk"]
        verbose_name = _("Media cleanup job")
        verbose_name_plural = _("Media cleanup jobs")
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["requested_by", "created_at"]),
        ]

    def __str__(self):
        return f"Media cleanup job #{self.pk} ({self.status})"
