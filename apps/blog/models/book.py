from django.conf import settings
from django.db import models
from django.urls import reverse
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

from apps.blog.media_paths import book_cover_upload_to

from .base import TimeStampedModel


class Book(TimeStampedModel):
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

    name = models.CharField(max_length=64, unique=True)
    slug = models.SlugField(max_length=80, unique=True)
    summary = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to=book_cover_upload_to, blank=True)
    visibility = models.CharField(max_length=16, choices=VISIBILITY_CHOICES, default=VISIBILITY_PUBLIC)
    condition_rules = models.JSONField(default=list, blank=True)
    access_scope = models.CharField(max_length=16, choices=ACCESS_SCOPE_CHOICES, default=ACCESS_SCOPE_UNIFIED)
    vip_access_permission = models.CharField(max_length=16, choices=VISIBILITY_CHOICES, default=VISIBILITY_PUBLIC)
    vip_condition_rules = models.JSONField(default=list, blank=True)
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
        super().save(*args, **kwargs)

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


class BookPurchaseRecord(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="book_purchase_records")
    book = models.ForeignKey(Book, on_delete=models.PROTECT, related_name="purchase_records")
    cost_money = models.PositiveIntegerField()

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["user", "book"], name="blog_bookpurchase_user_book_unique"),
        ]
        indexes = [
            models.Index(fields=["user", "book"]),
            models.Index(fields=["book", "created_at"]),
        ]

    def __str__(self):
        return f"Book purchase {self.book_id} by {self.user_id}"


class BookPasswordRecord(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="book_password_records")
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="password_records")

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["user", "book"], name="blog_bookpassword_user_book_unique"),
        ]
        indexes = [
            models.Index(fields=["user", "book"]),
        ]

    def __str__(self):
        return f"Book password verified {self.book_id} by {self.user_id}"


class BookStar(TimeStampedModel):
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="star_entries")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="book_star_entries")

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["book", "user"], name="blog_bookstar_book_user_unique"),
        ]
        indexes = [
            models.Index(fields=["book", "created_at"]),
            models.Index(fields=["user", "created_at"]),
        ]

    def __str__(self):
        return f"Book star for {self.book_id} by {self.user_id}"
