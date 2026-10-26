import secrets
from datetime import timedelta

from django.utils import timezone
from rest_framework.exceptions import ValidationError


EXPIRY_OPTIONS = {
    "1d": timedelta(days=1),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
    "never": None,
}


def is_external_link_eligible(article):
    return (
        article.visibility == article.VISIBILITY_PUBLIC
        and not article.condition_rules
        and article.access_scope == article.ACCESS_SCOPE_UNIFIED
        and article.vip_access_permission == article.VISIBILITY_PUBLIC
        and not article.vip_condition_rules
    )


def is_external_link_active(article, now=None):
    now = now or timezone.now()
    return bool(
        article.external_link_token
        and is_external_link_eligible(article)
        and (article.external_link_expires_at is None or article.external_link_expires_at > now)
    )


def clear_external_link(article):
    article.external_link_token = None
    article.external_link_expires_at = None
    article.external_link_password = None


def set_external_link_expiry(article, expiry):
    if expiry not in EXPIRY_OPTIONS:
        raise ValidationError({"expiry": "Invalid external-link expiry option."})
    article.external_link_expires_at = (
        timezone.now() + EXPIRY_OPTIONS[expiry] if EXPIRY_OPTIONS[expiry] else None
    )


def rotate_external_link(article, expiry):
    if not is_external_link_eligible(article):
        raise ValidationError({"detail": "Only published, unrestricted public articles can have external links."})
    article.external_link_token = secrets.token_urlsafe(24)
    set_external_link_expiry(article, expiry)


def is_book_external_link_eligible(book):
    return book.visibility == book.VISIBILITY_PUBLIC


def is_book_external_link_active(book, now=None):
    now = now or timezone.now()
    return bool(
        book.external_link_token
        and is_book_external_link_eligible(book)
        and (book.external_link_expires_at is None or book.external_link_expires_at > now)
    )


def rotate_book_external_link(book, expiry):
    if not is_book_external_link_eligible(book):
        raise ValidationError({"detail": "Only public books can have external links."})
    book.external_link_token = secrets.token_urlsafe(24)
    set_external_link_expiry(book, expiry)
