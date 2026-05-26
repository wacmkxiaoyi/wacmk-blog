from django import forms
from django.utils.translation import gettext_lazy as _

from apps.blog.models import Post


ENCRYPTED_POST_SESSION_KEY = "blog_unlocked_posts"


def get_post_unlock_session_key(post):
    return str(post.pk)


def get_unlocked_post_keys(request):
    raw_value = request.session.get(ENCRYPTED_POST_SESSION_KEY, [])
    if isinstance(raw_value, list):
        return {str(item) for item in raw_value}
    return set()


def mark_post_unlocked(request, post):
    unlocked = get_unlocked_post_keys(request)
    unlocked.add(get_post_unlock_session_key(post))
    request.session[ENCRYPTED_POST_SESSION_KEY] = sorted(unlocked)
    request.session.modified = True


def is_post_unlocked(request, post):
    return get_post_unlock_session_key(post) in get_unlocked_post_keys(request)


def can_bypass_post_password(user, post):
    return bool(user.is_staff or user.is_superuser or post.author_id == getattr(user, "pk", None))


def can_access_post(request, post):
    user = request.user
    if post.status != Post.STATUS_PUBLISHED:
        return False
    if can_bypass_post_password(user, post):
        return True
    if post.visibility == Post.VISIBILITY_PUBLIC:
        return True
    if post.visibility == Post.VISIBILITY_BOOK_ONLY:
        return False
    if post.visibility == Post.VISIBILITY_PRIVATE:
        return False
    if post.visibility == Post.VISIBILITY_ENCRYPTED:
        return is_post_unlocked(request, post)
    return False


def post_requires_password(request, post):
    return bool(
        post.visibility == Post.VISIBILITY_ENCRYPTED
        and not can_bypass_post_password(request.user, post)
        and not is_post_unlocked(request, post)
    )


class PostAccessForm(forms.Form):
    password = forms.CharField(
        label=_("Password"),
        widget=forms.PasswordInput(
            attrs={
                "class": "input-control",
                "placeholder": _("Enter article password"),
                "autocomplete": "current-password",
            }
        ),
    )


__all__ = [name for name in globals() if not name.startswith("_")]
