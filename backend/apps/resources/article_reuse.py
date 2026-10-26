from copy import copy
from pathlib import Path
import re

from django.core.files.storage import default_storage
from django.db.models import Q

from .access.application.resource_check_service import ResourceCheckService
from .models import Article, ArticleDraft, ArticleIdentity, MediaAsset, MediaAssetReference
from .zinc_search_apis import get_article_document
from apps.users.services.storage import ensure_user_storage_capacity


def _allows_book_only(resource, user):
    """Evaluate candidate access as if book-only rules had been satisfied."""
    rules = [rule for rule in resource.condition_rules if rule.get("type") != "book_only"]
    vip_rules = [rule for rule in resource.vip_condition_rules if rule.get("type") != "book_only"]
    if rules == resource.condition_rules and vip_rules == resource.vip_condition_rules:
        return ResourceCheckService.build_access_check(resource, user, resource_type="article").all_granted
    candidate = copy(resource)
    candidate.condition_rules = rules
    candidate.vip_condition_rules = vip_rules
    return ResourceCheckService.build_access_check(candidate, user, resource_type="article").all_granted


def can_reuse_article(article, user, permission):
    if not user.is_authenticated:
        return False
    is_manager = user.is_staff or user.is_superuser
    is_author = article.author_id == user.id
    if not (is_manager or is_author or getattr(article, permission)):
        return False
    return _allows_book_only(article, user)


def reusable_articles(user, permission, query=""):
    articles = Article.objects.select_related("author").prefetch_related("tags")
    if query:
        articles = articles.filter(
            Q(title__icontains=query)
            | Q(author__username__icontains=query)
            | Q(tags__name__icontains=query)
        ).distinct()
    return [article for article in articles.order_by("-published_at", "-updated_at", "-pk") if can_reuse_article(article, user, permission)]


ASSET_ID_RE = re.compile(r'assetId="([0-9a-fA-F-]{36})"')


def _copy_file(source_name, target_name, copied_files):
    if not source_name or not default_storage.exists(source_name):
        raise ValueError("Article media is unavailable.")
    with default_storage.open(source_name, "rb") as source:
        saved_name = default_storage.save(target_name, source)
    copied_files.append(saved_name)
    return saved_name


def _copy_inline_asset(asset, user, article_id, copied_files):
    clone = MediaAsset.objects.create(
        kind=asset.kind,
        file="",
        original_filename=asset.original_filename,
        media_type=asset.media_type,
        file_size=asset.file_size,
        checksum=asset.checksum,
        status=MediaAsset.STATUS_READY,
        uploaded_by=user,
    )
    target = f"content-assets/user-{user.pk}/articles/{article_id}/{clone.pk}"
    clone.file.name = _copy_file(asset.file.name, target, copied_files)
    clone.storage_key = clone.file.name
    clone.save(update_fields=("file", "storage_key", "updated_at"))
    return clone


def _copy_cover(article, user, article_id, copied_files):
    if not article.cover_image:
        return ""
    extension = Path(article.cover_image.name).suffix.lower()
    target = f"content-assets/user-{user.pk}/articles/{article_id}/background{extension}"
    return _copy_file(article.cover_image.name, target, copied_files)


def import_article_as_draft(article, user):
    copied_files = []
    try:
        article_id = ArticleIdentity.objects.create().pk
        source_document = get_article_document(article.pk)
        source_content = source_document.get("content", "")
        source_asset_ids = set(ASSET_ID_RE.findall(source_content))
        source_assets = MediaAsset.objects.filter(
            pk__in=source_asset_ids,
            status=MediaAsset.STATUS_READY,
            references__resource_type="article",
            references__resource_id=article.pk,
        ).distinct()
        assets_by_id = {str(asset.pk): asset for asset in source_assets}
        if len(assets_by_id) != len(source_asset_ids):
            raise ValueError("Article media is unavailable.")
        copied_size = sum(asset.file_size for asset in assets_by_id.values() if asset.kind != MediaAsset.KIND_ATTACHMENT)
        if article.cover_image:
            try:
                copied_size += default_storage.size(article.cover_image.name)
            except OSError:
                raise ValueError("Article media is unavailable.")
        ensure_user_storage_capacity(user, copied_size)

        replacements = {}
        references = []
        for source_id, asset in assets_by_id.items():
            if asset.kind == MediaAsset.KIND_ATTACHMENT:
                # Attachments are independent resources. Retain their existing
                # identities and make the imported article another consumer.
                if not asset.attachments.exists():
                    raise ValueError("Article attachment is unavailable.")
                references.append(MediaAssetReference(asset=asset, resource_type="article", resource_id=article_id))
                continue
            clone = _copy_inline_asset(asset, user, article_id, copied_files)
            replacements[source_id] = str(clone.pk)
            references.append(MediaAssetReference(asset=clone, resource_type="article", resource_id=article_id))

        content = source_content
        for source_id, replacement in replacements.items():
            content = content.replace(f'assetId="{source_id}"', f'assetId="{replacement}"')
        draft = ArticleDraft.objects.create(
            article_id=article_id,
            title=f"{article.title} (Copy)",
            abstract=source_document.get("abstract", ""),
            content=content,
            suppress_detail_hero=article.suppress_detail_hero,
            allow_quote=article.allow_quote,
            allow_reprint=article.allow_reprint,
            cover_image=_copy_cover(article, user, article_id, copied_files),
            author=user,
            visibility=article.visibility,
            condition_rules=article.condition_rules,
            access_scope=article.access_scope,
            vip_access_permission=article.vip_access_permission,
            vip_condition_rules=article.vip_condition_rules,
        )
        draft.tags.set(article.tags.all())
        MediaAssetReference.objects.bulk_create(references)
        return draft
    except Exception:
        for name in copied_files:
            if default_storage.exists(name):
                default_storage.delete(name)
        raise
