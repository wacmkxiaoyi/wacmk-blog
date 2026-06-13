from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.urls import reverse
from django.utils import timezone
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

from .base import TimeStampedModel


class Post(TimeStampedModel):
    STATUS_DRAFT = "draft"
    STATUS_PUBLISHED = "published"
    STATUS_CHOICES = [
        (STATUS_DRAFT, _("Draft")),
        (STATUS_PUBLISHED, _("Published")),
    ]

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
    slug = models.SlugField(max_length=220, unique=True)
    summary = models.TextField(blank=True)
    content = models.TextField()
    cover_image = models.ImageField(upload_to="blog/covers/", blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    visibility = models.CharField(max_length=16, choices=VISIBILITY_CHOICES, default=VISIBILITY_PUBLIC)
    condition_rules = models.JSONField(default=list, blank=True)
    access_scope = models.CharField(max_length=16, choices=ACCESS_SCOPE_CHOICES, default=ACCESS_SCOPE_UNIFIED)
    vip_access_permission = models.CharField(max_length=16, choices=VISIBILITY_CHOICES, default=VISIBILITY_PUBLIC)
    vip_condition_rules = models.JSONField(default=list, blank=True)
    published_at = models.DateTimeField(blank=True, null=True)
    view_count = models.PositiveIntegerField(default=0)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="posts")
    tags = models.ManyToManyField("blog.Tag", blank=True, related_name="posts")
    books = models.ManyToManyField("blog.Book", blank=True, related_name="posts")

    class Meta:
        ordering = ["-published_at", "-created_at"]
        indexes = [
            models.Index(fields=["status", "published_at"]),
            models.Index(fields=["slug"]),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        if self.status == self.STATUS_PUBLISHED and self.published_at is None:
            self.published_at = timezone.now()
        if self.status == self.STATUS_DRAFT:
            self.published_at = None
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        return reverse("blog-detail", kwargs={"slug": self.slug})

    @property
    def has_revision_draft(self):
        return getattr(self, "revision_draft", None) is not None

class PostDraft(TimeStampedModel):
    DRAFT_KIND_DRAFT = "draft"
    DRAFT_KIND_REVISION = "revision"

    source_post = models.OneToOneField(
        Post,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name="revision_draft",
    )
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220)
    summary = models.TextField(blank=True)
    content = models.TextField()
    cover_image = models.ImageField(upload_to="blog/covers/", blank=True)
    visibility = models.CharField(max_length=16, choices=Post.VISIBILITY_CHOICES, default=Post.VISIBILITY_PUBLIC)
    condition_rules = models.JSONField(default=list, blank=True)
    access_scope = models.CharField(max_length=16, choices=Post.ACCESS_SCOPE_CHOICES, default=Post.ACCESS_SCOPE_UNIFIED)
    vip_access_permission = models.CharField(max_length=16, choices=Post.VISIBILITY_CHOICES, default=Post.VISIBILITY_PUBLIC)
    vip_condition_rules = models.JSONField(default=list, blank=True)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="post_drafts")
    tags = models.ManyToManyField("blog.Tag", blank=True, related_name="post_drafts")
    books = models.ManyToManyField("blog.Book", blank=True, related_name="post_drafts")

    class Meta:
        ordering = ["-updated_at", "-created_at"]
        indexes = [
            models.Index(fields=["updated_at"]),
            models.Index(fields=["author", "updated_at"]),
            models.Index(fields=["slug"]),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)

    @property
    def draft_kind(self):
        if self.source_post_id:
            return self.DRAFT_KIND_REVISION
        return self.DRAFT_KIND_DRAFT

    @property
    def is_revision(self):
        return self.source_post_id is not None

class PostShareLink(TimeStampedModel):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="share_links")
    token = models.CharField(max_length=48, unique=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="post_share_links")
    expires_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at", "-pk"]
        indexes = [
            models.Index(fields=["token"]),
            models.Index(fields=["post", "expires_at"]),
        ]

    def __str__(self):
        return f"Share link for {self.post}"

    @property
    def is_expired(self):
        return self.expires_at is not None and timezone.now() >= self.expires_at

    def get_absolute_url(self):
        return reverse("blog-share-detail", kwargs={"token": self.token})


class ArticlePurchaseRecord(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="article_purchase_records")
    article = models.ForeignKey(Post, on_delete=models.PROTECT, related_name="purchase_records")
    cost_money = models.PositiveIntegerField()

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["user", "article"], name="blog_articlepurchase_user_article_unique"),
        ]
        indexes = [
            models.Index(fields=["user", "article"]),
            models.Index(fields=["article", "created_at"]),
        ]

    def __str__(self):
        return f"Article purchase {self.article_id} by {self.user_id}"


class PostPasswordRecord(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="post_password_records")
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="password_records")

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["user", "post"], name="blog_postpassword_user_post_unique"),
        ]
        indexes = [
            models.Index(fields=["user", "post"]),
        ]

    def __str__(self):
        return f"Post password verified {self.post_id} by {self.user_id}"


class PostFeedback(TimeStampedModel):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="feedback_entries")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="post_feedback_entries")
    value = models.SmallIntegerField(validators=[MinValueValidator(-1), MaxValueValidator(1)])

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["post", "user"], name="blog_postfeedback_post_user_unique"),
        ]
        indexes = [
            models.Index(fields=["post", "value"]),
            models.Index(fields=["user", "value"]),
        ]

    def __str__(self):
        return f"Post feedback {self.value} for {self.post_id} by {self.user_id}"

    def clean(self):
        super().clean()
        if self.value not in {-1, 1}:
            raise ValidationError({"value": _("Feedback value must be either 1 or -1.")})
