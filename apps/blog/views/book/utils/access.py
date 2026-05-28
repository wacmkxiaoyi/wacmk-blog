from django import forms
from django.utils.translation import gettext_lazy as _

from apps.blog.access import ACCESS_STATUS_GRANTED, evaluate_book_access
from apps.blog.models import Book
from apps.blog.visibility import book_has_encrypted_access, book_has_value_conditions


ENCRYPTED_BOOK_SESSION_KEY = "blog_unlocked_books"


def get_book_unlock_session_key(book):
    return str(book.pk)


def get_unlocked_book_keys(request):
    raw_value = request.session.get(ENCRYPTED_BOOK_SESSION_KEY, [])
    if isinstance(raw_value, list):
        return {str(item) for item in raw_value}
    return set()


def mark_book_unlocked(request, book):
    unlocked = get_unlocked_book_keys(request)
    unlocked.add(get_book_unlock_session_key(book))
    request.session[ENCRYPTED_BOOK_SESSION_KEY] = sorted(unlocked)
    request.session.modified = True


def is_book_unlocked(request, book):
    return get_book_unlock_session_key(book) in get_unlocked_book_keys(request)


def can_bypass_book_password(user, book):
    return bool(user.is_staff or user.is_superuser or book.created_by_id == getattr(user, "pk", None))


def can_access_book(request, book):
    user = request.user
    if can_bypass_book_password(user, book):
        return True
    is_unlocked = True
    if book_has_encrypted_access(book):
        is_unlocked = is_book_unlocked(request, book)
        if not is_unlocked:
            return False
    if book_has_value_conditions(book):
        return evaluate_book_access(user, book)["status"] == ACCESS_STATUS_GRANTED
    if book_has_encrypted_access(book):
        return is_unlocked
    if book.visibility == Book.VISIBILITY_PUBLIC:
        return True
    if book.visibility == Book.VISIBILITY_PRIVATE:
        return False
    return False


def book_requires_password(request, book):
    return bool(
        book_has_encrypted_access(book)
        and not can_bypass_book_password(request.user, book)
        and not is_book_unlocked(request, book)
    )


def get_book_condition_access_state(request, book):
    if not book_has_value_conditions(book) or can_bypass_book_password(request.user, book):
        return {"status": ACCESS_STATUS_GRANTED, "money_required": None, "points_required": None, "has_purchase": False}
    return evaluate_book_access(request.user, book)


class BookAccessForm(forms.Form):
    password = forms.CharField(
        label=_("Password"),
        widget=forms.PasswordInput(
            attrs={
                "class": "input-control",
                "placeholder": _("Enter book password"),
                "autocomplete": "current-password",
            }
        ),
    )


__all__ = [name for name in globals() if not name.startswith("_")]
