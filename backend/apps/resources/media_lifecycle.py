from pathlib import Path
import logging

from django.core.files.storage import default_storage
from django.db import transaction
from rest_framework import serializers

from .models import Article, ArticleDraft, Attachment, Book, MediaAsset, MediaAssetReference, ResourceStar, ResourceVote

logger = logging.getLogger(__name__)


def _delete_files(names):
    for name in set(filter(None, names)):
        if default_storage.exists(name):
            default_storage.delete(name)


def schedule_unreferenced_cover_cleanup(names):
    names = set(filter(None, names))
    if not names:
        return

    def cleanup():
        referenced = set(Article.objects.filter(cover_image__in=names).values_list("cover_image", flat=True))
        referenced.update(ArticleDraft.objects.filter(cover_image__in=names).values_list("cover_image", flat=True))
        referenced.update(Book.objects.filter(cover_image__in=names).values_list("cover_image", flat=True))
        _delete_files(names - referenced)

    transaction.on_commit(cleanup)


def promote_revision_cover(article, draft_cover_name):
    """Move a revision-only cover into the article's canonical cover location."""
    if not draft_cover_name or "/background-revision-" not in draft_cover_name:
        return draft_cover_name
    extension = Path(draft_cover_name).suffix.lower()
    target = f"content-assets/user-{article.author_id}/articles/{article.pk}/background{extension}"
    previous_target = target if default_storage.exists(target) else ""
    if previous_target:
        default_storage.delete(previous_target)
    with default_storage.open(draft_cover_name, "rb") as source:
        canonical_name = default_storage.save(target, source)
    return canonical_name


def _move_asset_to_article(asset, article):
    target = f"content-assets/user-{article.author_id}/articles/{article.article_id if isinstance(article, ArticleDraft) else article.pk}/{asset.pk}"
    if asset.file.name == target:
        return
    source = asset.file.name
    with asset.file.open("rb") as file:
        saved_name = default_storage.save(target, file)
    asset.file.name = saved_name
    asset.storage_key = saved_name
    asset.save(update_fields=("file", "storage_key", "updated_at"))
    if source and default_storage.exists(source):
        default_storage.delete(source)


def sync_article_assets(article, user, asset_ids, *, preserve_existing=False):
    assets = list(MediaAsset.objects.filter(
        pk__in=asset_ids,
        uploaded_by=user,
        status=MediaAsset.STATUS_READY,
    ))
    found_ids = {str(asset.pk) for asset in assets}
    unknown_ids = asset_ids - found_ids
    if unknown_ids:
        raise serializers.ValidationError({"content": "Content references unavailable media assets."})

    article_id = article.article_id if isinstance(article, ArticleDraft) else article.pk
    current_references = MediaAssetReference.objects.filter(resource_type="article", resource_id=article_id)
    current_asset_ids = set(str(asset_id) for asset_id in current_references.values_list("asset_id", flat=True))
    inline_asset_ids = {str(asset.pk) for asset in assets if asset.kind in (MediaAsset.KIND_IMAGE, MediaAsset.KIND_VIDEO)}
    other_references = MediaAssetReference.objects.filter(asset_id__in=inline_asset_ids).exclude(
        resource_type="article", resource_id=article_id
    )
    if other_references.exists():
        raise serializers.ValidationError({"content": "Content assets can only belong to one article."})

    removed_asset_ids = set() if preserve_existing else current_asset_ids - found_ids
    if not preserve_existing:
        current_references.exclude(asset_id__in=found_ids).delete()
    for asset in assets:
        if asset.kind in (MediaAsset.KIND_IMAGE, MediaAsset.KIND_VIDEO):
            _move_asset_to_article(asset, article)
    MediaAssetReference.objects.bulk_create([
        MediaAssetReference(asset=asset, resource_type="article", resource_id=article_id)
        for asset in assets
    ], ignore_conflicts=True)

    # Inline media belongs to exactly one article. Removing it from the body also
    # removes its private object instead of retaining inaccessible orphan files.
    orphaned_assets = list(MediaAsset.objects.filter(
        pk__in=removed_asset_ids,
        kind__in=(MediaAsset.KIND_IMAGE, MediaAsset.KIND_VIDEO),
        references__isnull=True,
    ))
    file_names = [asset.file.name for asset in orphaned_assets]
    MediaAsset.objects.filter(pk__in=[asset.pk for asset in orphaned_assets]).delete()
    transaction.on_commit(lambda: _delete_files(file_names))


def remove_article_from_structure(nodes, article_id):
    result = []
    changed = False
    for node in nodes:
        if node.get("type") == "article" and node.get("article_id") == article_id:
            changed = True
            continue
        if node.get("type") == "group":
            children, child_changed = remove_article_from_structure(node.get("children", []), article_id)
            if child_changed:
                node = {**node, "children": children}
                changed = True
        result.append(node)
    return result, changed


def delete_article(article):
    with transaction.atomic():
        article = Article.objects.select_for_update().get(pk=article.pk)
        # Article.books is a reverse lookup index for the authoritative JSON tree.
        for book in article.books.select_for_update():
            structure, changed = remove_article_from_structure(book.structure, article.pk)
            if changed:
                book.structure = structure
                book.save(update_fields=("structure", "updated_at"))
        references = MediaAssetReference.objects.select_for_update().filter(resource_type="article", resource_id=article.pk)
        asset_ids = list(references.values_list("asset_id", flat=True))
        references.delete()
        inline_assets = list(MediaAsset.objects.filter(
            pk__in=asset_ids,
            kind__in=(MediaAsset.KIND_IMAGE, MediaAsset.KIND_VIDEO),
            references__isnull=True,
        ))
        asset_files = [asset.file.name for asset in inline_assets]
        cover_names = [article.cover_image.name]
        cover_names.extend(ArticleDraft.objects.filter(article_id=article.pk).values_list("cover_image", flat=True))
        MediaAsset.objects.filter(pk__in=[asset.pk for asset in inline_assets]).delete()
        ResourceStar.objects.filter(resource_type="article", resource_id=article.pk).delete()
        ResourceVote.objects.filter(resource_type="article", resource_id=article.pk).delete()
        ArticleDraft.objects.filter(article_id=article.pk).delete()
        article_id = article.pk
        article.delete()
        from .zinc_search_apis import delete_article as delete_article_document

        def remove_search_document():
            try:
                delete_article_document(article_id)
            except Exception:
                logger.exception("Could not remove ZincSearch documents for article %s", article_id)

        transaction.on_commit(remove_search_document)
        schedule_unreferenced_cover_cleanup(cover_names)
        transaction.on_commit(lambda: _delete_files(asset_files))


def delete_article_draft(draft):
    with transaction.atomic():
        draft = ArticleDraft.objects.select_for_update().get(pk=draft.pk)
        # Revisions share this namespace with their published article, so only
        # standalone drafts own and may remove its media references.
        if Article.objects.filter(pk=draft.article_id).exists():
            cover_name = draft.cover_image.name
            draft.delete()
            schedule_unreferenced_cover_cleanup([cover_name])
            return
        references = MediaAssetReference.objects.select_for_update().filter(
            resource_type="article", resource_id=draft.article_id
        )
        asset_ids = list(references.values_list("asset_id", flat=True))
        references.delete()
        inline_assets = list(MediaAsset.objects.filter(
            pk__in=asset_ids,
            kind__in=(MediaAsset.KIND_IMAGE, MediaAsset.KIND_VIDEO),
            references__isnull=True,
        ))
        asset_files = [asset.file.name for asset in inline_assets]
        cover_name = draft.cover_image.name
        MediaAsset.objects.filter(pk__in=[asset.pk for asset in inline_assets]).delete()
        draft.delete()
        schedule_unreferenced_cover_cleanup([cover_name])
        transaction.on_commit(lambda: _delete_files(asset_files))


def delete_book(book):
    """Delete a book without deleting the articles it indexes."""
    with transaction.atomic():
        book = Book.objects.select_for_update().get(pk=book.pk)
        cover_name = book.cover_image.name
        ResourceStar.objects.filter(resource_type="book", resource_id=book.pk).delete()
        ResourceVote.objects.filter(resource_type="book", resource_id=book.pk).delete()
        MediaAssetReference.objects.filter(resource_type="book", resource_id=book.pk).delete()
        book_id = book.pk
        book.delete()
        from .zinc_search_apis import delete_book as delete_book_document

        def remove_search_document():
            try:
                delete_book_document(book_id)
            except Exception:
                logger.exception("Could not remove ZincSearch document for book %s", book_id)

        transaction.on_commit(remove_search_document)
        transaction.on_commit(lambda: _delete_files([cover_name]))


def delete_attachment(attachment):
    """Delete an attachment, its shared records and every content reference."""
    with transaction.atomic():
        attachment = Attachment.objects.select_for_update().select_related("asset").get(pk=attachment.pk)
        asset = attachment.asset
        MediaAssetReference.objects.select_for_update().filter(asset=asset).delete()
        Attachment.objects.filter(asset=asset).delete()
        file_name = asset.file.name
        asset.delete()
        transaction.on_commit(lambda: _delete_files([file_name]))


def schedule_user_media_cleanup(user):
    article_files = list(Article.objects.filter(author=user).values_list("cover_image", flat=True))
    draft_files = list(ArticleDraft.objects.filter(author=user).values_list("cover_image", flat=True))
    book_files = list(Book.objects.filter(created_by=user).values_list("cover_image", flat=True))
    asset_files = list(MediaAsset.objects.filter(uploaded_by=user).values_list("file", flat=True))
    avatar_name = user.avatar.name
    transaction.on_commit(lambda: _delete_files([avatar_name, *article_files, *draft_files, *book_files, *asset_files]))
