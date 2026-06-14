import re

from django.db.models import F
from django.template.loader import render_to_string
from django.utils import timezone

from apps.blog.access import get_access_handler
from apps.blog.models import Attachment
from apps.blog.utils.markdown import render_markdown
from apps.blog.visibility import (
    get_attachment_access_icon_presentation,
    get_attachment_access_display,
    get_attachment_condition_summary_items,
)
from apps.blog.access.display import (
    annotate_vip_badge,
    get_attachment_vip_condition_summary_items,
    get_attachment_vip_visibility_presentation,
)


ATTACHMENT_PLACEHOLDER_PATTERN = re.compile(r"\{\{attachment:(\d+)\}\}")
ATTACHMENT_BLOCK_PATTERN = re.compile(r"<p>\s*\{\{attachment:(\d+)\}\}\s*</p>")


def build_attachment_placeholder(attachment_id):
    return f"{{{{attachment:{int(attachment_id)}}}}}"


def iter_attachment_ids(content):
    for match in ATTACHMENT_PLACEHOLDER_PATTERN.finditer(content or ""):
        yield int(match.group(1))


def format_file_size(size):
    size_value = int(size or 0)
    if size_value < 1024:
        return f"{size_value} B"
    if size_value < 1024 * 1024:
        return f"{size_value / 1024:.1f} KB"
    return f"{size_value / (1024 * 1024):.1f} MB"


def get_attachment_icon_name(attachment):
    ext = str(getattr(attachment, "file_ext", "") or "").lower()
    if ext == "pdf":
        return "file-pdf"
    if ext in {"zip", "rar", "7z", "tar", "gz"}:
        return "file-zipper"
    if ext in {"doc", "docx", "rtf", "odt"}:
        return "file-word"
    if ext in {"xls", "xlsx", "csv"}:
        return "file-excel"
    if ext in {"ppt", "pptx"}:
        return "file-powerpoint"
    if ext in {"mp3", "wav", "ogg", "flac", "m4a"}:
        return "file-audio"
    if ext in {"mp4", "mov", "avi", "mkv", "webm"}:
        return "file-video"
    if ext in {"png", "jpg", "jpeg", "gif", "webp", "svg"}:
        return "file-image"
    if ext in {"txt", "md", "json", "xml", "yml", "yaml", "ini", "log"}:
        return "file-lines"
    return "paperclip"


def should_render_attachment_for_user(attachment, user, *, is_share_view=False):
    handler = get_access_handler(attachment, user)
    if handler.is_author_or_staff(user):
        return True
    if is_share_view:
        return handler.effective_visibility == Attachment.VISIBILITY_PUBLIC
    return handler.effective_visibility != Attachment.VISIBILITY_PRIVATE


def build_attachment_render_context(attachment, user, *, compact=False, is_share_view=False):
    annotate_vip_badge(attachment)
    should_render = should_render_attachment_for_user(attachment, user, is_share_view=is_share_view)
    return {
        "attachment": attachment,
        "attachment_access_display": get_attachment_access_display(attachment),
        "attachment_access_icon_presentation": get_attachment_access_icon_presentation(attachment),
        "attachment_condition_summary_items": get_attachment_condition_summary_items(attachment),
        "attachment_vip_condition_summary_items": get_attachment_vip_condition_summary_items(attachment),
        "attachment_vip_visibility_presentation": get_attachment_vip_visibility_presentation(attachment),
        "show_attachment_vip_badge": getattr(attachment, "show_vip_badge", False),
        "attachment_icon_name": get_attachment_icon_name(attachment),
        "attachment_size_label": format_file_size(getattr(attachment, "file_size", 0)),
        "attachment_extension_label": str(getattr(attachment, "file_ext", "") or "").upper(),
        "attachment_should_render": should_render,
        "attachment_compact": compact,
        "attachment_is_share_view": is_share_view,
        "attachment_download_url": attachment.get_download_url(),
    }


def render_attachment_markup(attachment_id, user, *, request=None, compact=False, is_share_view=False):
    attachment = Attachment.objects.select_related("uploaded_by").filter(pk=attachment_id).first()
    if attachment is None:
        return render_to_string(
            "blog/includes/attachment_missing.html",
            {"attachment_id": attachment_id},
            request=request,
        )
    if not should_render_attachment_for_user(attachment, user, is_share_view=is_share_view):
        return ""
    context = build_attachment_render_context(attachment, user, compact=compact, is_share_view=is_share_view)
    return render_to_string("blog/includes/attachment_card.html", context, request=request)


def render_markdown_with_attachments(content, user, *, request=None, compact=False, is_share_view=False):
    source_content = content or ""
    rendered_html = render_markdown(source_content)
    if "{{attachment:" not in source_content and "{{attachment:" not in rendered_html:
        return rendered_html

    def replace_match(match):
        attachment_id = int(match.group(1))
        return render_attachment_markup(attachment_id, user, request=request, compact=compact, is_share_view=is_share_view)

    rendered_html = ATTACHMENT_BLOCK_PATTERN.sub(replace_match, rendered_html)
    return ATTACHMENT_PLACEHOLDER_PATTERN.sub(replace_match, rendered_html)


def mark_attachments_referenced(content):
    attachment_ids = sorted(set(iter_attachment_ids(content or "")))
    if not attachment_ids:
        return
    Attachment.objects.filter(pk__in=attachment_ids).update(last_referenced_at=timezone.now(), usage_count=F("usage_count") + 1)


__all__ = [
    "ATTACHMENT_PLACEHOLDER_PATTERN",
    "build_attachment_placeholder",
    "build_attachment_render_context",
    "format_file_size",
    "iter_attachment_ids",
    "mark_attachments_referenced",
    "render_attachment_markup",
    "render_markdown_with_attachments",
    "should_render_attachment_for_user",
]
