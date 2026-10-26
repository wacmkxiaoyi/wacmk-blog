from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils.text import slugify

from apps.authorization_core.application.user_identity_service import UserIdentityService
from .access.mixins import AccessControlledResourceMixin
# Register access-record models in the same Django app without exposing them as resource entities.
from .access.infrastructure.models import ResourceGranted, ResourcePurchased  # noqa: F401


def content_upload_path(instance, filename, category):
    extension = Path(filename).suffix.lower()
    owner_id = getattr(instance, "author_id", None) or getattr(instance, "created_by_id", None) or getattr(instance, "uploaded_by_id", None) or "new"
    return f"content/users/{owner_id}/{category}/{instance.pk or 'new'}{extension}"


def resource_slug(title, fallback, model, instance_pk=None, max_length=220):
    """Build a non-empty, model-unique URL slug for titles in any language."""
    base = slugify(title) or fallback
    candidate = base[:max_length]
    if not model.objects.filter(slug=candidate).exclude(pk=instance_pk).exists():
        return candidate
    suffix = f"-{instance_pk or uuid4().hex[:8]}"
    return f"{base[:max_length - len(suffix)]}{suffix}"


def article_cover_upload_to(instance, filename):
    extension = Path(filename).suffix.lower()
    article_id = getattr(instance, "article_id", None) or instance.pk or "new"
    owner_id = getattr(instance, "author_id", None) or "new"
    # A revision shares its article namespace with the live article. Keep an
    # un-published replacement isolated until the revision is published.
    is_revision = isinstance(instance, ArticleDraft) and Article.objects.filter(pk=article_id).exists()
    name = f"background-revision-{instance.pk or 'new'}" if is_revision else "background"
    target = f"content-assets/user-{owner_id}/articles/{article_id}/{name}{extension}"
    # Django's default storage suffixes an occupied filename. Canonical covers
    # are owned by this resource, so remove the previous object before saving.
    storage = instance.cover_image.storage
    if storage.exists(target):
        storage.delete(target)
    return target


def book_cover_upload_to(instance, filename):
    extension = Path(filename).suffix.lower()
    owner_id = instance.created_by_id or "new"
    book_id = instance.pk or "new"
    target = f"content-assets/user-{owner_id}/books/{book_id}/background{extension}"
    storage = instance.cover_image.storage
    if storage.exists(target):
        storage.delete(target)
    return target


def media_asset_upload_to(instance, filename):
    # Object keys are independent from access policy. Storage must not expose this prefix.
    asset_id = instance.pk or uuid4()
    user_id = instance.uploaded_by_id or "new"
    if instance.kind == MediaAsset.KIND_ATTACHMENT:
        return f"content-assets/user-{user_id}/attachments/{asset_id}"
    # Inline assets are staged until their article is first saved, then moved to
    # content-assets/user-<id>/articles/<article_id>/.
    return f"content-assets/user-{user_id}/uploads/{asset_id}"


class ContentTimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ArticleIdentity(models.Model):
    """Reserves monotonic article IDs for both drafts and published articles."""
    id = models.BigAutoField(primary_key=True)

    class Meta:
        db_table = "article_identities"


class MediaAsset(ContentTimestampedModel):
    KIND_IMAGE = "image"
    KIND_VIDEO = "video"
    KIND_ATTACHMENT = "attachment"
    KIND_CHOICES = ((KIND_IMAGE, "Image"), (KIND_VIDEO, "Video"), (KIND_ATTACHMENT, "Attachment"))

    STATUS_READY = "ready"
    STATUS_QUARANTINED = "quarantined"
    STATUS_DELETED = "deleted"
    STATUS_CHOICES = ((STATUS_READY, "Ready"), (STATUS_QUARANTINED, "Quarantined"), (STATUS_DELETED, "Deleted"))

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    kind = models.CharField(max_length=16, choices=KIND_CHOICES)
    file = models.FileField(upload_to=media_asset_upload_to)
    storage_key = models.CharField(max_length=512, blank=True, editable=False)
    original_filename = models.CharField(max_length=255)
    media_type = models.CharField(max_length=255, blank=True, default="")
    file_size = models.PositiveBigIntegerField(default=0)
    checksum = models.CharField(max_length=128, blank=True, default="")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_READY)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="media_assets")

    class Meta:
        db_table = "media_assets"
        ordering = ("-updated_at",)
        indexes = [models.Index(fields=("uploaded_by", "kind", "updated_at"), name="media_asset_owner_kind_idx")]

class Article(AccessControlledResourceMixin, ContentTimestampedModel):
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    suppress_detail_hero = models.BooleanField(default=False)
    allow_quote = models.BooleanField(default=True)
    allow_reprint = models.BooleanField(default=False)
    cover_image = models.ImageField(upload_to=article_cover_upload_to, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    external_link_token = models.CharField(max_length=48, unique=True, blank=True, null=True, default=None)
    external_link_expires_at = models.DateTimeField(null=True, blank=True)
    external_link_password = models.CharField(max_length=255, blank=True, null=True, default=None)
    view_count = models.PositiveBigIntegerField(default=0)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="articles")
    tags = models.ManyToManyField("tags.Tag", blank=True, related_name="articles")
    books = models.ManyToManyField("Book", blank=True, related_name="articles")

    class Meta:
        db_table = "articles"
        ordering = ("-published_at", "-updated_at", "-pk")
        indexes = [models.Index(fields=("published_at",), name="articles_published_idx"), models.Index(fields=("author", "updated_at"))]

    def save(self, *args, **kwargs):
        if not self.pk:
            self.pk = ArticleIdentity.objects.create().pk
        if not self.slug:
            self.slug = resource_slug(self.title, f"article-{self.pk or 'new'}", Article, self.pk)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title

    @classmethod
    def invisible_conditions(cls, user):
        """Resources a visitor can never open from the direct article listing."""
        if user.is_staff or user.is_superuser:
            return Q()
        is_vip = user.is_authenticated and UserIdentityService.resolve(user).is_vip
        if is_vip:
            private = Q(access_scope=cls.ACCESS_SCOPE_STANDALONE, vip_access_permission=cls.VISIBILITY_PRIVATE) | Q(access_scope=cls.ACCESS_SCOPE_UNIFIED, visibility=cls.VISIBILITY_PRIVATE)
            book_only = Q(access_scope=cls.ACCESS_SCOPE_STANDALONE, vip_condition_rules__contains=[{"type": "book_only"}]) | Q(access_scope=cls.ACCESS_SCOPE_UNIFIED, condition_rules__contains=[{"type": "book_only"}])
        else:
            private = Q(visibility=cls.VISIBILITY_PRIVATE)
            book_only = Q(condition_rules__contains=[{"type": "book_only"}])
        return (private | book_only) & ~Q(author=user)


class ArticleDraft(AccessControlledResourceMixin, ContentTimestampedModel):
    # This is the future article PK for standalone drafts and the existing article
    # PK for revisions. Media remains owned by this stable article namespace.
    article_id = models.PositiveBigIntegerField(unique=True)
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    abstract = models.TextField(blank=True, default="")
    content = models.TextField(blank=True, default="")
    suppress_detail_hero = models.BooleanField(default=False)
    allow_quote = models.BooleanField(default=True)
    allow_reprint = models.BooleanField(default=False)
    cover_image = models.ImageField(upload_to=article_cover_upload_to, blank=True)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="article_drafts")
    tags = models.ManyToManyField("tags.Tag", blank=True, related_name="article_drafts")

    class Meta:
        db_table = "article_drafts"
        ordering = ("-updated_at", "-pk")
        indexes = [models.Index(fields=("author", "updated_at"), name="article_drafts_author_idx"), models.Index(fields=("article_id", "updated_at"), name="article_drafts_article_idx")]

    @property
    def is_revision(self):
        return Article.objects.filter(pk=self.article_id).exists()

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = resource_slug(self.title, f"article-{self.article_id or self.pk or 'new'}", ArticleDraft, self.pk)
        super().save(*args, **kwargs)


class Book(AccessControlledResourceMixin, ContentTimestampedModel):
    name = models.CharField(max_length=64, unique=True)
    slug = models.SlugField(max_length=80, unique=True)
    cover_image = models.ImageField(upload_to=book_cover_upload_to, blank=True)
    structure = models.JSONField(default=list, blank=True)
    external_link_token = models.CharField(max_length=48, unique=True, blank=True, null=True, default=None)
    external_link_expires_at = models.DateTimeField(null=True, blank=True)
    external_link_password = models.CharField(max_length=255, blank=True, null=True, default=None)
    view_count = models.PositiveBigIntegerField(default=0)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="books")

    class Meta:
        db_table = "books"
        ordering = ("-updated_at", "-pk")
        indexes = [models.Index(fields=("created_by", "updated_at"))]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = resource_slug(self.name, f"book-{self.pk or 'new'}", Book, self.pk, max_length=80)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    @classmethod
    def invisible_conditions(cls, user):
        """Resources a visitor can never open from the direct book listing."""
        if user.is_staff or user.is_superuser:
            return Q()
        is_vip = user.is_authenticated and UserIdentityService.resolve(user).is_vip
        if is_vip:
            private = Q(access_scope=cls.ACCESS_SCOPE_STANDALONE, vip_access_permission=cls.VISIBILITY_PRIVATE) | Q(access_scope=cls.ACCESS_SCOPE_UNIFIED, visibility=cls.VISIBILITY_PRIVATE)
        else:
            private = Q(visibility=cls.VISIBILITY_PRIVATE)
        return private & ~Q(created_by=user)


class ResourceStar(models.Model):
    RESOURCE_TYPE_ARTICLE = "article"
    RESOURCE_TYPE_BOOK = "book"
    RESOURCE_TYPE_CHOICES = ((RESOURCE_TYPE_ARTICLE, "Article"), (RESOURCE_TYPE_BOOK, "Book"))

    resource_type = models.CharField(max_length=16, choices=RESOURCE_TYPE_CHOICES)
    resource_id = models.PositiveBigIntegerField()
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="resource_stars")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "resource_stars"
        constraints = [models.UniqueConstraint(fields=("resource_type", "resource_id", "user"), name="resource_star_unique")]
        indexes = [models.Index(fields=("resource_type", "resource_id"), name="resource_star_resource_idx")]


class ResourceVote(models.Model):
    VOTE_UP = "up"
    VOTE_DOWN = "down"
    VOTE_CHOICES = ((VOTE_UP, "Up"), (VOTE_DOWN, "Down"))

    resource_type = models.CharField(max_length=16, choices=ResourceStar.RESOURCE_TYPE_CHOICES)
    resource_id = models.PositiveBigIntegerField()
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="resource_votes")
    vote = models.CharField(max_length=4, choices=VOTE_CHOICES)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "resource_votes"
        constraints = [models.UniqueConstraint(fields=("resource_type", "resource_id", "user"), name="resource_vote_unique")]
        indexes = [models.Index(fields=("resource_type", "resource_id", "vote"), name="resource_vote_resource_idx")]


class Attachment(AccessControlledResourceMixin, ContentTimestampedModel):
    title = models.CharField(max_length=255)
    asset = models.ForeignKey(MediaAsset, on_delete=models.PROTECT, related_name="attachments")
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=255, blank=True, default="")
    file_size = models.PositiveBigIntegerField(default=0)
    file_ext = models.CharField(max_length=32, blank=True, default="")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="attachments")
    usage_count = models.PositiveIntegerField(default=0)
    download_count = models.PositiveIntegerField(default=0)
    last_referenced_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "attachments"
        ordering = ("-updated_at", "-pk")
        indexes = [models.Index(fields=("uploaded_by", "updated_at"))]

    def __str__(self):
        return self.title


class MediaAssetReference(ContentTimestampedModel):
    asset = models.ForeignKey(MediaAsset, on_delete=models.CASCADE, related_name="references")
    resource_type = models.CharField(max_length=16)
    resource_id = models.PositiveBigIntegerField()
    usage = models.CharField(max_length=32, default="body")

    class Meta:
        db_table = "media_asset_references"
        constraints = [models.UniqueConstraint(fields=("asset", "resource_type", "resource_id", "usage"), name="media_asset_reference_unique")]
        indexes = [models.Index(fields=("resource_type", "resource_id"), name="media_asset_ref_resource_idx")]
