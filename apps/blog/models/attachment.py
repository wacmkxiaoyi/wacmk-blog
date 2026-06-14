import os

from django.conf import settings
from django.db import models
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from .base import TimeStampedModel


class Attachment(TimeStampedModel):
    VISIBILITY_PUBLIC = "public"
    VISIBILITY_PRIVATE = "private"
    VISIBILITY_CONDITIONAL = "conditional"
    VISIBILITY_CHOICES = [
        (VISIBILITY_PUBLIC, _("Public")),
        (VISIBILITY_PRIVATE, _("Private")),
        (VISIBILITY_CONDITIONAL, _("Conditional")),
    ]

    ACCESS_SCOPE_UNIFIED = "unified"
    ACCESS_SCOPE_STANDALONE = "standalone"
    ACCESS_SCOPE_CHOICES = [
        (ACCESS_SCOPE_UNIFIED, _("Unified")),
        (ACCESS_SCOPE_STANDALONE, _("Standalone")),
    ]

    title = models.CharField(max_length=200)
    file = models.FileField(upload_to="blog/attachments/")
    original_filename = models.CharField(max_length=255, blank=True)
    mime_type = models.CharField(max_length=120, blank=True)
    file_size = models.PositiveBigIntegerField(default=0)
    file_ext = models.CharField(max_length=32, blank=True)
    visibility = models.CharField(max_length=16, choices=VISIBILITY_CHOICES, default=VISIBILITY_PUBLIC)
    condition_rules = models.JSONField(default=list, blank=True)
    access_scope = models.CharField(max_length=16, choices=ACCESS_SCOPE_CHOICES, default=ACCESS_SCOPE_UNIFIED)
    vip_access_permission = models.CharField(max_length=16, choices=VISIBILITY_CHOICES, default=VISIBILITY_PUBLIC)
    vip_condition_rules = models.JSONField(default=list, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="attachments")
    usage_count = models.PositiveIntegerField(default=0)
    download_count = models.PositiveIntegerField(default=0)
    last_referenced_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-updated_at", "-created_at", "-pk"]
        indexes = [
            models.Index(fields=["uploaded_by", "updated_at"]),
            models.Index(fields=["visibility", "updated_at"]),
        ]

    def __str__(self):
        return self.title or self.original_filename or f"Attachment {self.pk}"

    def save(self, *args, **kwargs):
        current_name = getattr(self.file, "name", "") or ""
        original_name = os.path.basename(current_name)
        if original_name and not self.original_filename:
            self.original_filename = original_name
        if original_name and not self.file_ext:
            self.file_ext = os.path.splitext(original_name)[1].lower().lstrip(".")
        if getattr(self.file, "size", None) and not self.file_size:
            self.file_size = self.file.size
        super().save(*args, **kwargs)

    def get_download_url(self):
        return reverse("attachment-download", kwargs={"pk": self.pk})

    def get_absolute_url(self):
        return self.get_download_url()

    def get_access_check_url(self):
        return reverse("attachment-access-check", kwargs={"pk": self.pk})


class AttachmentPasswordRecord(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="attachment_password_records")
    attachment = models.ForeignKey(Attachment, on_delete=models.CASCADE, related_name="password_records")

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["user", "attachment"], name="blog_attachmentpassword_user_attachment_unique"),
        ]
        indexes = [
            models.Index(fields=["user", "attachment"]),
        ]

    def __str__(self):
        return f"Attachment password verified {self.attachment_id} by {self.user_id}"


class AttachmentPurchaseRecord(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="attachment_purchase_records")
    attachment = models.ForeignKey(Attachment, on_delete=models.PROTECT, related_name="purchase_records")
    cost_money = models.PositiveIntegerField()

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["user", "attachment"], name="blog_attachmentpurchase_user_attachment_unique"),
        ]
        indexes = [
            models.Index(fields=["user", "attachment"]),
            models.Index(fields=["attachment", "created_at"]),
        ]

    def __str__(self):
        return f"Attachment purchase {self.attachment_id} by {self.user_id}"
