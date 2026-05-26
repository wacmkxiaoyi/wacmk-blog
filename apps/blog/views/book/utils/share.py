from django.utils.translation import gettext_lazy as _

from apps.blog.models import Book
from apps.blog.utils.site import build_share_expiry_options, format_share_link_expires_display


def build_book_share_editor_context(book, request):
    active_share_link = None
    if getattr(book, "pk", None):
        active_share_link = book.share_links.order_by("-created_at", "-pk").first()

    is_public = getattr(book, "visibility", Book.VISIBILITY_PUBLIC) == Book.VISIBILITY_PUBLIC
    is_saved = bool(getattr(book, "pk", None))
    can_generate = bool(is_public and is_saved)

    if not is_public:
        disabled_message = ""
    elif not is_saved:
        disabled_message = str(_("Save this book before generating an external link."))
    else:
        disabled_message = ""

    current_url = ""
    current_expires = ""
    if active_share_link is not None:
        current_url = request.build_absolute_uri(active_share_link.get_absolute_url())
        current_expires = format_share_link_expires_display(active_share_link)

    return {
        "book_share_is_public": is_public,
        "book_share_can_generate": can_generate,
        "book_share_disabled_message": disabled_message,
        "book_share_active_link": active_share_link,
        "book_share_current_url": current_url,
        "book_share_current_expires": current_expires,
        "book_share_expiry_options": build_share_expiry_options(),
    }


__all__ = ["build_book_share_editor_context"]
