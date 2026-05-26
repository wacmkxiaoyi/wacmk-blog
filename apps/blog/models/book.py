from django.conf import settings
from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from django.db import models
from django.urls import reverse
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

from .base import TimeStampedModel


class Book(TimeStampedModel):
    VISIBILITY_PUBLIC = "public"
    VISIBILITY_PRIVATE = "private"
    VISIBILITY_ENCRYPTED = "encrypted"
    VISIBILITY_CHOICES = [
        (VISIBILITY_PUBLIC, _("Public")),
        (VISIBILITY_PRIVATE, _("Private")),
        (VISIBILITY_ENCRYPTED, _("Encrypted")),
    ]

    name = models.CharField(max_length=64, unique=True)
    slug = models.SlugField(max_length=80, unique=True)
    summary = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to="blog/book-covers/", blank=True)
    visibility = models.CharField(max_length=16, choices=VISIBILITY_CHOICES, default=VISIBILITY_PUBLIC)
    access_password = models.CharField(max_length=128, blank=True)
    structure = models.JSONField(default=list, blank=True)
    view_count = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_books",
        blank=True,
        null=True,
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        if self.access_password:
            try:
                identify_hasher(self.access_password)
            except ValueError:
                self.access_password = make_password(self.access_password)
        super().save(*args, **kwargs)

    def check_access_password(self, raw_password):
        if not self.access_password:
            return False
        return check_password(raw_password or "", self.access_password)

    def get_absolute_url(self):
        return reverse("book-detail", kwargs={"slug": self.slug})


class BookShareLink(TimeStampedModel):
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="share_links")
    token = models.CharField(max_length=48, unique=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="book_share_links")
    expires_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at", "-pk"]
        indexes = [
            models.Index(fields=["token"]),
            models.Index(fields=["book", "expires_at"]),
        ]

    def __str__(self):
        return f"Share link for {self.book}"

    @property
    def is_expired(self):
        from django.utils import timezone

        return self.expires_at is not None and timezone.now() >= self.expires_at

    def get_absolute_url(self):
        return reverse("book-share-detail", kwargs={"token": self.token})
