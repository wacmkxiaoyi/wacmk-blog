from django.conf import settings
from django.db import models


class SiteSetting(models.Model):
    """A registered site setting value. The key determines its schema in code."""

    key = models.CharField(max_length=128, unique=True)
    value = models.JSONField()
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="updated_site_settings",
    )

    class Meta:
        db_table = "site_settings"
        ordering = ("key",)

    def __str__(self):
        return self.key


class AuditLog(models.Model):
    """Immutable management events for site settings and their assets."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="site_settings_audit_logs",
    )
    action = models.CharField(max_length=64)
    summary = models.CharField(max_length=255)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "site_settings_audit_logs"
        ordering = ("-created_at", "-id")
        indexes = [
            models.Index(fields=("-created_at", "-id"), name="site_audit_created_idx"),
            models.Index(fields=("action", "-created_at"), name="site_audit_action_idx"),
            models.Index(fields=("actor", "-created_at"), name="site_audit_actor_idx"),
        ]

    def __str__(self):
        return f"{self.action}: {self.summary}"


class AuditCleanupRun(models.Model):
    STATUS_RUNNING = "running"
    STATUS_SUCCEEDED = "succeeded"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = (
        (STATUS_RUNNING, "Running"),
        (STATUS_SUCCEEDED, "Succeeded"),
        (STATUS_FAILED, "Failed"),
    )

    source = models.CharField(max_length=32, default="scheduled")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_RUNNING)
    retention_days = models.PositiveIntegerField()
    cutoff_at = models.DateTimeField()
    deleted_count = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        db_table = "site_settings_audit_cleanup_runs"
        ordering = ("-started_at", "-id")

    def __str__(self):
        return f"Audit cleanup {self.status} at {self.started_at}"
