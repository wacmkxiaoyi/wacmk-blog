import os
import posixpath
from pathlib import Path

from django.conf import settings


USER_MEDIA_ROOT = "users"
ADMIN_FALLBACK_USER_ID = 1
USER_AVATAR_DIRECTORY = "avatar"
USER_ATTACHMENT_DIRECTORY = "attachment"
USER_IMAGE_DIRECTORY = "image"
USER_VIDEO_DIRECTORY = "video"
USER_POST_COVER_DIRECTORY = "post-cover"
USER_BOOK_COVER_DIRECTORY = "book-cover"


def _normalize_filename(filename):
    name = os.path.basename(str(filename or "")).strip()
    return name or "file"


def build_user_media_directory(user):
    normalized_user_id = int(getattr(user, "pk", None) or ADMIN_FALLBACK_USER_ID)
    return posixpath.join(USER_MEDIA_ROOT, str(normalized_user_id))


def build_user_media_path(user, *parts, filename):
    directory = build_user_media_directory(user)
    normalized_parts = [str(part).strip("/") for part in parts if str(part or "").strip("/")]
    return posixpath.join(directory, *normalized_parts, _normalize_filename(filename))


def avatar_upload_to(instance, filename):
    return build_user_media_path(getattr(instance, "user", None), USER_AVATAR_DIRECTORY, filename=filename)


def attachment_upload_to(instance, filename):
    return build_user_media_path(getattr(instance, "uploaded_by", None), USER_ATTACHMENT_DIRECTORY, filename=filename)


def post_cover_upload_to(instance, filename):
    return build_user_media_path(getattr(instance, "author", None), USER_POST_COVER_DIRECTORY, filename=filename)


def book_cover_upload_to(instance, filename):
    return build_user_media_path(getattr(instance, "created_by", None), USER_BOOK_COVER_DIRECTORY, filename=filename)


def editor_image_upload_path(user, filename):
    return build_user_media_path(user, USER_IMAGE_DIRECTORY, filename=filename)


def editor_video_upload_path(user, filename):
    return build_user_media_path(user, USER_VIDEO_DIRECTORY, filename=filename)


def admin_attachment_upload_path(filename):
    return build_user_media_path(None, USER_ATTACHMENT_DIRECTORY, filename=filename)


def admin_image_upload_path(filename):
    return build_user_media_path(None, USER_IMAGE_DIRECTORY, filename=filename)


def admin_video_upload_path(filename):
    return build_user_media_path(None, USER_VIDEO_DIRECTORY, filename=filename)


def build_media_url(relative_path):
    normalized = str(relative_path or "").replace("\\", "/").strip("/")
    if not normalized:
        return settings.MEDIA_URL
    return settings.MEDIA_URL.rstrip("/") + "/" + normalized


def resolve_media_path(relative_path):
    normalized = str(relative_path or "").replace("\\", "/").strip("/")
    return Path(settings.MEDIA_ROOT) / normalized


__all__ = [
    "ADMIN_FALLBACK_USER_ID",
    "USER_ATTACHMENT_DIRECTORY",
    "USER_AVATAR_DIRECTORY",
    "USER_BOOK_COVER_DIRECTORY",
    "USER_IMAGE_DIRECTORY",
    "USER_POST_COVER_DIRECTORY",
    "USER_VIDEO_DIRECTORY",
    "admin_attachment_upload_path",
    "admin_image_upload_path",
    "admin_video_upload_path",
    "attachment_upload_to",
    "avatar_upload_to",
    "book_cover_upload_to",
    "build_media_url",
    "build_user_media_directory",
    "build_user_media_path",
    "editor_image_upload_path",
    "editor_video_upload_path",
    "post_cover_upload_to",
    "resolve_media_path",
]
