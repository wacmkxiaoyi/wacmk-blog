import re
from pathlib import Path
from urllib.parse import unquote

from django.conf import settings

from apps.blog.models import Attachment, Book, Comment, Post, PostDraft, SiteSetting
from apps.blog.utils.attachments import iter_attachment_ids
from apps.blog.utils.site import SITE_SETTING_FILE_KEYS, iter_live2d_bundle_relative_paths
from apps.users.models import UserProfile


MEDIA_URL_REFERENCE_PATTERN = re.compile(r"(?P<full>/media/(?P<path>[^\s\)\]\"'>]+))")


def normalize_media_relative_path(path):
    normalized = str(path or "").replace("\\", "/").strip()
    if not normalized:
        return ""
    normalized = normalized.split("#", 1)[0].split("?", 1)[0]
    media_url = str(settings.MEDIA_URL or "/media/").replace("\\", "/").strip()
    if media_url and normalized.startswith(media_url):
        normalized = normalized[len(media_url):]
    elif normalized.startswith("/media/"):
        normalized = normalized[len("/media/"):]
    normalized = unquote(normalized)
    normalized = normalized.lstrip("/")
    if not normalized or normalized in {".", ".."}:
        return ""
    normalized_path = Path(normalized)
    if normalized_path.is_absolute() or ".." in normalized_path.parts:
        return ""
    return normalized.replace("\\", "/")


def iter_media_references_in_text(content):
    for match in MEDIA_URL_REFERENCE_PATTERN.finditer(content or ""):
        relative_path = normalize_media_relative_path(match.group("path"))
        if relative_path:
            yield relative_path


def collect_referenced_media_paths():
    referenced_paths = set()
    attachment_files = {
        attachment.pk: normalize_media_relative_path(attachment.file.name)
        for attachment in Attachment.objects.exclude(file="").only("pk", "file")
    }
    referenced_paths.update(path for path in attachment_files.values() if path)

    for model, field_name in ((Post, "cover_image"), (PostDraft, "cover_image"), (Book, "cover_image"), (UserProfile, "avatar")):
        for value in model.objects.exclude(**{field_name: ""}).values_list(field_name, flat=True):
            normalized = normalize_media_relative_path(value)
            if normalized:
                referenced_paths.add(normalized)

    for value in SiteSetting.objects.filter(key__in=SITE_SETTING_FILE_KEYS).values_list("value", flat=True):
        normalized = normalize_media_relative_path(value)
        if normalized:
            referenced_paths.add(normalized)

    referenced_paths.update(path for path in iter_live2d_bundle_relative_paths() if path)

    for content in Post.objects.values_list("content", flat=True):
        _collect_text_references(content, attachment_files, referenced_paths)
    for content in PostDraft.objects.values_list("content", flat=True):
        _collect_text_references(content, attachment_files, referenced_paths)
    for content in Comment.objects.values_list("content", flat=True):
        _collect_text_references(content, attachment_files, referenced_paths)

    for summary in Post.objects.values_list("summary", flat=True):
        referenced_paths.update(iter_media_references_in_text(summary))
    for summary in Book.objects.values_list("summary", flat=True):
        referenced_paths.update(iter_media_references_in_text(summary))
    for value in SiteSetting.objects.values_list("value", flat=True):
        referenced_paths.update(iter_media_references_in_text(value))

    return referenced_paths


def _collect_text_references(content, attachment_files, referenced_paths):
    referenced_paths.update(iter_media_references_in_text(content))
    for attachment_id in iter_attachment_ids(content or ""):
        path = attachment_files.get(attachment_id)
        if path:
            referenced_paths.add(path)


def iter_media_files():
    media_root = Path(settings.MEDIA_ROOT)
    if not media_root.exists() or not media_root.is_dir():
        return
    for path in media_root.rglob("*"):
        if path.is_file():
            yield path


def cleanup_unused_media_files(*, dry_run=False):
    media_root = Path(settings.MEDIA_ROOT)
    referenced_paths = collect_referenced_media_paths()
    scanned_file_count = 0
    kept_file_count = 0
    deleted_file_count = 0
    deleted_directory_count = 0

    if media_root.exists() and media_root.is_dir():
        for file_path in iter_media_files() or []:
            scanned_file_count += 1
            relative_path = normalize_media_relative_path(file_path.relative_to(media_root))
            if relative_path in referenced_paths:
                kept_file_count += 1
                continue
            if not dry_run:
                file_path.unlink(missing_ok=True)
            deleted_file_count += 1

        directories = sorted((path for path in media_root.rglob("*") if path.is_dir()), key=lambda item: len(item.parts), reverse=True)
        for directory in directories:
            if directory == media_root:
                continue
            if any(directory.iterdir()):
                continue
            if not dry_run:
                directory.rmdir()
            deleted_directory_count += 1

    return {
        "referenced_path_count": len(referenced_paths),
        "scanned_file_count": scanned_file_count,
        "kept_file_count": kept_file_count,
        "deleted_file_count": deleted_file_count,
        "deleted_directory_count": deleted_directory_count,
    }


__all__ = [
    "cleanup_unused_media_files",
    "collect_referenced_media_paths",
    "iter_media_references_in_text",
    "normalize_media_relative_path",
]
