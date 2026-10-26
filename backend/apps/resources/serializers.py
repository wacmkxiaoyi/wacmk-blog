from pathlib import Path
import re

from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .access.domain.rules import normalize_condition_rules
from apps.tags.models import Tag

from .models import Article, ArticleDraft, ArticleIdentity, Attachment, Book, MediaAsset
from .media_lifecycle import schedule_unreferenced_cover_cleanup, sync_article_assets
from .external_links import clear_external_link, is_book_external_link_eligible, is_external_link_eligible
from .services import validate_upload
from .media_urls import cover_url
from .zinc_search_apis import ZincSearchError, get_article_document, get_book_document, index_article, index_book
from apps.users.services.storage import ensure_user_storage_capacity


ASSET_ID_RE = re.compile(r'assetId="([0-9a-fA-F-]{36})"')


def sync_article_asset_references(article, user):
    asset_ids = set(ASSET_ID_RE.findall(article.content or ""))
    sync_article_assets(article, user, asset_ids, preserve_existing=isinstance(article, ArticleDraft) and Article.objects.filter(pk=article.article_id).exists())


class AccessRulesSerializerMixin:
    def validate(self, attrs):
        attrs = super().validate(attrs)
        effective_visibility = attrs.get("visibility", getattr(self.instance, "visibility", "public"))
        if effective_visibility == Attachment.VISIBILITY_PUBLIC:
            attrs["access_scope"] = Attachment.ACCESS_SCOPE_UNIFIED
        for field_name in ("condition_rules", "vip_condition_rules"):
            if field_name not in attrs:
                continue
            rules = attrs[field_name]
            normalized = normalize_condition_rules(rules)
            attrs[field_name] = [
                {"type": rule.type, **({"value": make_password(str(rule.value))} if rule.type == "encrypted" and rule.value and not str(rule.value).startswith("pbkdf2_") else ({"value": rule.value} if rule.value is not None else {}))}
                for rule in normalized
            ]
            existing_password = next(
                (
                    rule.get("value", "")
                    for rule in getattr(self.instance, field_name, [])
                    if rule.get("type") == "encrypted"
                ),
                "",
            )
            for rule in attrs[field_name]:
                if rule["type"] == "encrypted" and not rule.get("value") and existing_password:
                    rule["value"] = existing_password
        scope = attrs.get("access_scope", getattr(self.instance, "access_scope", Attachment.ACCESS_SCOPE_UNIFIED))
        if effective_visibility != Attachment.VISIBILITY_CONDITIONAL:
            attrs["condition_rules"] = []
        if effective_visibility == Attachment.VISIBILITY_PUBLIC or scope != Attachment.ACCESS_SCOPE_STANDALONE:
            attrs["vip_access_permission"] = Attachment.VISIBILITY_PUBLIC
            attrs["vip_condition_rules"] = []
        effective_rules = attrs.get("condition_rules", getattr(self.instance, "condition_rules", []))
        effective_vip_visibility = attrs.get("vip_access_permission", getattr(self.instance, "vip_access_permission", Attachment.VISIBILITY_PUBLIC))
        effective_vip_rules = attrs.get("vip_condition_rules", getattr(self.instance, "vip_condition_rules", []))
        errors = {}
        if effective_visibility == Attachment.VISIBILITY_CONDITIONAL and not effective_rules:
            errors["condition_rules"] = "Conditional access requires at least one condition."
        if scope == Attachment.ACCESS_SCOPE_STANDALONE and effective_vip_visibility == Attachment.VISIBILITY_CONDITIONAL and not effective_vip_rules:
            errors["vip_condition_rules"] = "Conditional VIP access requires at least one condition."
        for field_name, rules in (
            ("condition_rules", effective_rules),
            ("vip_condition_rules", effective_vip_rules),
        ):
            if any(rule["type"] == "encrypted" and not rule.get("value") for rule in rules):
                errors[field_name] = "Encrypted access requires a password."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        for field_name in ("condition_rules", "vip_condition_rules"):
            data[field_name] = [
                {key: value for key, value in rule.items() if key != "value" or rule.get("type") != "encrypted"}
                for rule in data.get(field_name, [])
            ]
        return data


class AuthorSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    displayName = serializers.SerializerMethodField()

    def get_displayName(self, user):
        return user.get_full_name() or user.username


class TagSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)


class ArticleSerializer(AccessRulesSerializerMixin, serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True, max_length=220)
    author = AuthorSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(source="tags", queryset=Tag.objects.all(), many=True, required=False, write_only=True)
    tag_names = serializers.CharField(write_only=True, required=False, allow_blank=True)
    coverUrl = serializers.SerializerMethodField()
    publishedAt = serializers.DateTimeField(source="published_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    viewCount = serializers.IntegerField(source="view_count", read_only=True)
    interaction = serializers.SerializerMethodField()
    remove_cover = serializers.BooleanField(write_only=True, required=False, default=False)
    cover_image = serializers.ImageField(write_only=True, required=False)
    abstract = serializers.CharField(required=False, allow_blank=True, write_only=True)
    content = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Article
        fields = ("id", "title", "slug", "abstract", "content", "suppress_detail_hero", "allow_quote", "allow_reprint", "cover_image", "remove_cover", "coverUrl", "publishedAt", "updatedAt", "viewCount", "author", "tags", "tag_ids", "tag_names", "visibility", "condition_rules", "access_scope", "vip_access_permission", "vip_condition_rules", "interaction")
        read_only_fields = ()

    def get_coverUrl(self, obj):
        if not obj.cover_image:
            return ""
        request = self.context.get("request")
        return cover_url(obj, "article", request.user) if request else ""

    def get_interaction(self, obj):
        return getattr(obj, "interaction", {"isStarred": False, "currentVote": None, "upCount": 0, "downCount": 0})

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not self.context.get("include_content", True):
            data.pop("content", None)
            return data
        # Published bodies live outside MySQL; fail closed rather than rendering partial data.
        content = getattr(instance, "_zinc_article_document", None) or self.context.get("article_content", {}).get(instance.pk)
        if content is None:
            content = get_article_document(instance.pk)
        data["abstract"] = content.get("abstract", "")
        data["content"] = content.get("content", "")
        return data

    def validate_cover_image(self, value):
        try:
            validate_upload(value, "image")
        except serializers.ValidationError as exc:
            raise serializers.ValidationError(exc.detail.get("file", exc.detail)) from exc
        ensure_user_storage_capacity(self.context["request"].user, value.size)
        return value

    def validate_slug(self, value):
        if value and Article.objects.filter(slug=value).exclude(pk=getattr(self.instance, "pk", None)).exists():
            raise serializers.ValidationError("An article with this URL slug already exists.")
        return value

    def validate_tag_names(self, value):
        names = []
        for name in value.split(","):
            name = name.strip()
            if name and name not in names:
                names.append(name)
        if any(len(name) > 32 for name in names):
            raise serializers.ValidationError("Each tag must be at most 32 characters.")
        return names

    def create(self, validated_data):
        abstract = validated_data.pop("abstract", "")
        content = validated_data.pop("content", "")
        tags = validated_data.pop("tags", [])
        tag_names = validated_data.pop("tag_names", None)
        validated_data.pop("remove_cover", None)
        validated_data["published_at"] = timezone.now()
        with transaction.atomic():
            article = Article.objects.create(author=self.context["request"].user, **validated_data)
            article.tags.set([Tag.objects.get_or_create(name=name)[0] for name in tag_names] if tag_names is not None else tags)
            sync_article_assets(article, self.context["request"].user, set(ASSET_ID_RE.findall(content)))
            index_article(article, abstract, content)
            article._zinc_article_document = {"abstract": abstract, "content": content}
        return article

    def update(self, instance, validated_data):
        try:
            stored = get_article_document(instance.pk)
        except ZincSearchError as exc:
            raise serializers.ValidationError({"detail": str(exc)}) from exc
        abstract = validated_data.pop("abstract", stored.get("abstract", ""))
        content = validated_data.pop("content", stored.get("content", ""))
        tags = validated_data.pop("tags", None)
        tag_names = validated_data.pop("tag_names", None)
        remove_cover = validated_data.pop("remove_cover", False)
        old_cover_name = instance.cover_image.name
        with transaction.atomic():
            if remove_cover and "cover_image" not in validated_data:
                instance.cover_image = None
            for field, value in validated_data.items():
                setattr(instance, field, value)
            if not is_external_link_eligible(instance):
                clear_external_link(instance)
            instance.save()
            if tag_names is not None:
                instance.tags.set([Tag.objects.get_or_create(name=name)[0] for name in tag_names])
            elif tags is not None:
                instance.tags.set(tags)
            sync_article_assets(instance, self.context["request"].user, set(ASSET_ID_RE.findall(content)))
            index_article(instance, abstract, content)
            instance._zinc_article_document = {"abstract": abstract, "content": content}
            if old_cover_name != instance.cover_image.name:
                schedule_unreferenced_cover_cleanup([old_cover_name])
        return instance


class ArticleDraftSerializer(AccessRulesSerializerMixin, serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True, max_length=220)
    title = serializers.CharField(max_length=200, allow_blank=True)
    author = AuthorSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(source="tags", queryset=Tag.objects.all(), many=True, required=False, write_only=True)
    tag_names = serializers.CharField(write_only=True, required=False, allow_blank=True)
    coverUrl = serializers.SerializerMethodField()
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    draftKind = serializers.SerializerMethodField()
    remove_cover = serializers.BooleanField(write_only=True, required=False, default=False)
    cover_image = serializers.ImageField(write_only=True, required=False)

    class Meta:
        model = ArticleDraft
        fields = ("id", "article_id", "title", "slug", "abstract", "content", "suppress_detail_hero", "allow_quote", "allow_reprint", "cover_image", "remove_cover", "coverUrl", "author", "tags", "tag_ids", "tag_names", "visibility", "condition_rules", "access_scope", "vip_access_permission", "vip_condition_rules", "updatedAt", "createdAt", "draftKind")
        read_only_fields = ("article_id",)

    def get_coverUrl(self, obj):
        if not obj.cover_image:
            return ""
        request = self.context.get("request")
        return cover_url(obj, "draft", request.user) if request else ""

    def get_draftKind(self, obj):
        return "revision" if Article.objects.filter(pk=obj.article_id).exists() else "draft"

    def validate_cover_image(self, value):
        try:
            validate_upload(value, "image")
        except serializers.ValidationError as exc:
            raise serializers.ValidationError(exc.detail.get("file", exc.detail)) from exc
        ensure_user_storage_capacity(self.context["request"].user, value.size)
        return value

    def validate_slug(self, value):
        if value and ArticleDraft.objects.filter(slug=value).exclude(pk=getattr(self.instance, "pk", None)).exists():
            raise serializers.ValidationError("A draft with this URL slug already exists.")
        return value

    def validate_tag_names(self, value):
        names = []
        for name in value.split(","):
            name = name.strip()
            if name and name not in names:
                names.append(name)
        if any(len(name) > 32 for name in names):
            raise serializers.ValidationError("Each tag must be at most 32 characters.")
        return names

    def create(self, validated_data):
        tags = validated_data.pop("tags", [])
        tag_names = validated_data.pop("tag_names", None)
        validated_data.pop("remove_cover", None)
        with transaction.atomic():
            draft = ArticleDraft.objects.create(article_id=ArticleIdentity.objects.create().pk, author=self.context["request"].user, **validated_data)
            draft.tags.set([Tag.objects.get_or_create(name=name)[0] for name in tag_names] if tag_names is not None else tags)
            sync_article_asset_references(draft, self.context["request"].user)
        return draft

    def update(self, instance, validated_data):
        tags = validated_data.pop("tags", None)
        tag_names = validated_data.pop("tag_names", None)
        remove_cover = validated_data.pop("remove_cover", False)
        old_cover_name = instance.cover_image.name
        with transaction.atomic():
            if remove_cover and "cover_image" not in validated_data:
                instance.cover_image = None
            for field, value in validated_data.items():
                setattr(instance, field, value)
            instance.save()
            if tag_names is not None:
                instance.tags.set([Tag.objects.get_or_create(name=name)[0] for name in tag_names])
            elif tags is not None:
                instance.tags.set(tags)
            sync_article_asset_references(instance, self.context["request"].user)
            if old_cover_name != instance.cover_image.name:
                schedule_unreferenced_cover_cleanup([old_cover_name])
        return instance


class ManagedArticleSerializer(serializers.ModelSerializer):
    author = AuthorSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    publishedAt = serializers.DateTimeField(source="published_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    viewCount = serializers.IntegerField(source="view_count", read_only=True)

    class Meta:
        model = Article
        fields = (
            "id",
            "title",
            "slug",
            "kind",
            "visibility",
            "condition_rules",
            "access_scope",
            "vip_access_permission",
            "vip_condition_rules",
            "publishedAt",
            "updatedAt",
            "createdAt",
            "viewCount",
            "author",
            "tags",
        )

    kind = serializers.SerializerMethodField()

    def get_kind(self, obj):
        return "published"


class ManagedArticleDraftSerializer(serializers.ModelSerializer):
    author = AuthorSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    kind = serializers.SerializerMethodField()

    class Meta:
        model = ArticleDraft
        fields = ("id", "article_id", "title", "slug", "abstract", "visibility", "updatedAt", "createdAt", "author", "tags", "kind")

    def get_kind(self, obj):
        return "revision" if Article.objects.filter(pk=obj.article_id).exists() else "draft"


class BookSerializer(AccessRulesSerializerMixin, serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True, max_length=80)
    coverUrl = serializers.SerializerMethodField()
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    articleCount = serializers.SerializerMethodField()
    interaction = serializers.SerializerMethodField()
    cover_image = serializers.ImageField(write_only=True, required=False)
    remove_cover = serializers.BooleanField(write_only=True, required=False, default=False)
    abstract = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Book
        fields = ("id", "name", "slug", "abstract", "cover_image", "remove_cover", "coverUrl", "structure", "articleCount", "updatedAt", "visibility", "condition_rules", "access_scope", "vip_access_permission", "vip_condition_rules", "interaction")
        read_only_fields = ()

    def get_coverUrl(self, obj):
        if not obj.cover_image:
            return ""
        request = self.context.get("request")
        return cover_url(obj, "book", request.user) if request else ""

    def get_articleCount(self, obj):
        return len(list_article_ids(obj.structure))

    def get_interaction(self, obj):
        return getattr(obj, "interaction", {"isStarred": False, "currentVote": None, "upCount": 0, "downCount": 0})

    def to_representation(self, instance):
        data = super().to_representation(instance)
        document = getattr(instance, "_zinc_book_document", None) or self.context.get("book_content", {}).get(instance.pk)
        if document is None:
            document = get_book_document(instance.pk)
        data["abstract"] = document.get("abstract", "")
        return data

    def validate_cover_image(self, value):
        try:
            validate_upload(value, "image")
        except serializers.ValidationError as exc:
            raise serializers.ValidationError(exc.detail.get("file", exc.detail)) from exc
        ensure_user_storage_capacity(self.context["request"].user, value.size)
        return value

    def validate_slug(self, value):
        if value and Book.objects.filter(slug=value).exclude(pk=getattr(self.instance, "pk", None)).exists():
            raise serializers.ValidationError("A book with this URL slug already exists.")
        return value

    def validate_structure(self, value):
        article_ids = list_article_ids(value)
        if len(article_ids) != len(set(article_ids)):
            raise serializers.ValidationError("An article can only appear once in a book.")
        existing_ids = set(Article.objects.filter(pk__in=article_ids).values_list("pk", flat=True))
        missing_ids = set(article_ids) - existing_ids
        if missing_ids:
            raise serializers.ValidationError(f"Unknown article IDs: {sorted(missing_ids)}")
        user = self.context["request"].user
        if not (user.is_staff or user.is_superuser):
            from .article_reuse import can_reuse_article
            articles = Article.objects.filter(pk__in=article_ids).select_related("author")
            if any(not can_reuse_article(article, user, "allow_quote") for article in articles):
                raise serializers.ValidationError("One or more articles cannot be added to this book.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        structure = attrs.get("structure", getattr(self.instance, "structure", []))
        if not list_article_ids(structure):
            raise serializers.ValidationError({"structure": "A book must contain at least one article."})
        return attrs


    def create(self, validated_data):
        abstract = validated_data.pop("abstract", "")
        validated_data.pop("remove_cover", None)
        cover_image = validated_data.pop("cover_image", None)
        structure = validated_data.get("structure", [])
        with transaction.atomic():
            book = Book.objects.create(created_by=self.context["request"].user, **validated_data)
            book.articles.set(list_article_ids(structure))
            if cover_image:
                book.cover_image = cover_image
                book.save(update_fields=("cover_image", "updated_at"))
            index_book(book, abstract)
            book._zinc_book_document = {"abstract": abstract}
        return book

    def update(self, instance, validated_data):
        try:
            stored = get_book_document(instance.pk)
        except ZincSearchError as exc:
            raise serializers.ValidationError({"detail": str(exc)}) from exc
        abstract = validated_data.pop("abstract", stored.get("abstract", ""))
        remove_cover = validated_data.pop("remove_cover", False)
        old_cover_name = instance.cover_image.name
        with transaction.atomic():
            if remove_cover and "cover_image" not in validated_data:
                instance.cover_image = None
            for field, value in validated_data.items():
                setattr(instance, field, value)
            if not is_book_external_link_eligible(instance):
                clear_external_link(instance)
            instance.save()
            if "structure" in validated_data:
                instance.articles.set(list_article_ids(instance.structure))
            if old_cover_name != instance.cover_image.name:
                schedule_unreferenced_cover_cleanup([old_cover_name])
            index_book(instance, abstract)
            instance._zinc_book_document = {"abstract": abstract}
        return instance


class ManagedBookSerializer(serializers.ModelSerializer):
    author = AuthorSerializer(source="created_by", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    articleCount = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = (
            "id",
            "name",
            "slug",
            "visibility",
            "condition_rules",
            "access_scope",
            "vip_access_permission",
            "vip_condition_rules",
            "articleCount",
            "updatedAt",
            "author",
        )

    def get_articleCount(self, obj):
        return len(list_article_ids(obj.structure))


def list_article_ids(nodes):
    if not isinstance(nodes, list):
        raise serializers.ValidationError("Book structure must be an array.")
    article_ids = []
    for node in nodes:
        if not isinstance(node, dict):
            raise serializers.ValidationError("Each book node must be an object.")
        if node.get("type") == "article":
            article_id = node.get("article_id")
            if not isinstance(article_id, int) or article_id < 1:
                raise serializers.ValidationError("Article nodes require a positive article_id.")
            article_ids.append(article_id)
        elif node.get("type") == "group":
            if not isinstance(node.get("title"), str) or not node["title"].strip():
                raise serializers.ValidationError("Group nodes require a title.")
            article_ids.extend(list_article_ids(node.get("children")))
        else:
            raise serializers.ValidationError("Book nodes must have type article or group.")
    return article_ids


class AttachmentSerializer(AccessRulesSerializerMixin, serializers.ModelSerializer):
    assetId = serializers.UUIDField(source="asset_id", read_only=True)
    reused_asset_id = serializers.UUIDField(write_only=True, required=False)
    placeholder = serializers.SerializerMethodField()
    fileSizeLabel = serializers.SerializerMethodField()
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    uploadedBy = AuthorSerializer(source="uploaded_by", read_only=True)

    class Meta:
        model = Attachment
        fields = ("id", "assetId", "reused_asset_id", "title", "placeholder", "original_filename", "mime_type", "file_size", "fileSizeLabel", "file_ext", "download_count", "usage_count", "uploadedBy", "updatedAt", "visibility", "condition_rules", "access_scope", "vip_access_permission", "vip_condition_rules", "created_at")
        read_only_fields = ("assetId", "placeholder", "original_filename", "mime_type", "file_size", "file_ext", "created_at")

    def get_placeholder(self, obj):
        return f'::custom{{kind="attachment" assetId="{obj.asset_id}" title="{obj.title}"}}'

    def get_fileSizeLabel(self, obj):
        size = obj.file_size
        for unit in ("B", "KB", "MB", "GB"):
            if size < 1024 or unit == "GB":
                return f"{size:.1f} {unit}" if unit != "B" else f"{size} B"
            size /= 1024

    def validate(self, attrs):
        attrs = super().validate(attrs)
        scope = attrs.get("access_scope", getattr(self.instance, "access_scope", Attachment.ACCESS_SCOPE_UNIFIED))
        if scope == Attachment.ACCESS_SCOPE_STANDALONE and attrs.get("vip_access_permission", getattr(self.instance, "vip_access_permission", Attachment.VISIBILITY_PUBLIC)) != Attachment.VISIBILITY_CONDITIONAL:
            attrs["vip_condition_rules"] = []
        if self.instance and "reused_asset_id" in attrs:
            raise serializers.ValidationError({"reused_asset_id": "Replacing an attachment file is not supported."})
        return attrs

    def create(self, validated_data):
        file = self.context["request"].FILES.get("file")
        asset_id = validated_data.pop("reused_asset_id", None)
        if asset_id and file:
            raise serializers.ValidationError(
                "Choose a file or an uploaded attachment, not both.",
            )
        if asset_id:
            try:
                asset = MediaAsset.objects.get(
                    pk=asset_id,
                    kind=MediaAsset.KIND_ATTACHMENT,
                    status=MediaAsset.STATUS_READY,
                    uploaded_by=self.context["request"].user,
                )
            except (MediaAsset.DoesNotExist, ValueError):
                raise serializers.ValidationError(
                    {"reused_asset_id": "The uploaded attachment is unavailable."},
                )
            return Attachment.objects.create(
                uploaded_by=self.context["request"].user,
                asset=asset,
                original_filename=asset.original_filename,
                mime_type=asset.media_type,
                file_size=asset.file_size,
                file_ext=Path(asset.original_filename).suffix.lower().lstrip("."),
                title=validated_data.pop("title", "") or Path(asset.original_filename).stem,
                **validated_data,
            )
        if not file:
            raise serializers.ValidationError({"file": "A file is required."})
        title = validated_data.pop("title", "") or Path(file.name).stem
        media_type = getattr(file, "content_type", "") or "application/octet-stream"
        asset = MediaAsset.objects.create(
            kind=MediaAsset.KIND_ATTACHMENT,
            file=file,
            original_filename=file.name,
            media_type=media_type,
            file_size=file.size,
            uploaded_by=self.context["request"].user,
        )
        MediaAsset.objects.filter(pk=asset.pk).update(storage_key=asset.file.name)
        asset.storage_key = asset.file.name
        return Attachment.objects.create(
            uploaded_by=self.context["request"].user,
            asset=asset,
            original_filename=file.name,
            mime_type=media_type,
            file_size=file.size,
            file_ext=Path(file.name).suffix.lower().lstrip("."),
            title=title,
            **validated_data,
        )
