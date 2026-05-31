from django import forms
from django.utils.translation import gettext_lazy as _

from apps.blog.access import ACCESS_STATUS_GRANTED, evaluate_article_access
from apps.blog.models import Post
from apps.blog.visibility import post_has_encrypted_access, post_has_value_conditions, post_is_book_only


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
    if post.visibility == Post.VISIBILITY_PRIVATE:
        return False
    if post_is_book_only(post):
        return False
    is_unlocked = True
    if post_has_encrypted_access(post):
        is_unlocked = is_post_unlocked(request, post)
        if not is_unlocked:
            return False
    if post_has_value_conditions(post):
        return evaluate_article_access(user, post)["status"] == ACCESS_STATUS_GRANTED
    if post_has_encrypted_access(post):
        return is_unlocked
    return post.visibility == Post.VISIBILITY_PUBLIC


def get_book_post_access_state(request, post):
    user = request.user
    info = {
        "can_add": True,
        "requires_password": False,
        "requires_condition": False,
        "condition_status": "",
        "condition_money": "",
        "condition_points": "",
    }

    if post.status != Post.STATUS_PUBLISHED:
        info["can_add"] = False
        return info

    if can_bypass_post_password(user, post):
        return info

    if post.visibility == Post.VISIBILITY_PRIVATE:
        info["can_add"] = False
        return info

    if post_has_encrypted_access(post) and not is_post_unlocked(request, post):
        info["requires_password"] = True

    if post_has_value_conditions(post):
        access_state = evaluate_article_access(user, post)
        if access_state["status"] != ACCESS_STATUS_GRANTED:
            info["requires_condition"] = True
            info["condition_status"] = access_state["status"]
            info["condition_money"] = str(access_state["money_required"] or "")
            info["condition_points"] = str(access_state["points_required"] or "")

    return info


def can_add_post_to_book(request, post):
    access_state = get_book_post_access_state(request, post)
    return bool(
        access_state["can_add"]
        and not access_state["requires_password"]
        and not access_state["requires_condition"]
    )


def post_requires_password(request, post):
    return bool(
        post_has_encrypted_access(post)
        and not can_bypass_post_password(request.user, post)
        and not is_post_unlocked(request, post)
    )


def post_requires_condition(request, post):
    return bool(
        not post_requires_password(request, post)
        and post_has_value_conditions(post)
        and get_post_condition_access_state(request, post)["status"] != ACCESS_STATUS_GRANTED
    )


def get_post_condition_access_state(request, post):
    if not post_has_value_conditions(post) or can_bypass_post_password(request.user, post):
        return {"status": ACCESS_STATUS_GRANTED, "money_required": None, "points_required": None, "has_purchase": False}
    return evaluate_article_access(request.user, post)


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
