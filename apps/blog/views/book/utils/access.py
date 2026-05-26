from django import forms
from django.utils.translation import gettext_lazy as _

from apps.blog.models import Book


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
    if book.visibility == Book.VISIBILITY_PUBLIC:
        return True
    if book.visibility == Book.VISIBILITY_PRIVATE:
        return False
    if book.visibility == Book.VISIBILITY_ENCRYPTED:
        return is_book_unlocked(request, book)
    return False


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
