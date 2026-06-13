from apps.blog.access import build_access_check
from apps.blog.models import Post
from apps.blog.permissions import CONDITION_TYPE_BOOK_ONLY, has_condition_rule


def _post_is_book_only(post):
    return has_condition_rule(post.condition_rules, CONDITION_TYPE_BOOK_ONLY)


def can_access_post(request, post):
    return build_access_check(post, request.user)["all_granted"]


def get_book_post_access_state(request, post):
    check = build_access_check(post, request.user)
    is_book_only = any(
        c["type"] == "book_only" for c in check["conditions"]
    )
    can_add = check["all_granted"] or is_book_only or any(
        c["action"] == "purchase" for c in check["conditions"]
    )
    return {
        "can_add": can_add,
        "requires_password": any(
            c["type"] == "encrypted" and c["status"] == "pending" and not is_book_only
            for c in check["conditions"]
        ),
        "requires_condition": not can_add and not any(
            c["type"] == "book_only" for c in check["conditions"]
        ),
        "condition_status": next(
            (c.get("status", "") for c in check["conditions"] if c.get("action") == "purchase"), ""
        ),
        "condition_money": str(
            next((c.get("requirement", "") for c in check["conditions"] if c["type"] == "money"), "")
        ),
        "condition_points": str(
            next((c.get("requirement", "") for c in check["conditions"] if c["type"] == "points"), "")
        ),
    }


def can_add_post_to_book(request, post):
    access_state = get_book_post_access_state(request, post)
    return bool(
        access_state["can_add"]
        and not access_state["requires_password"]
        and not access_state["requires_condition"]
    )


def post_requires_password(request, post):
    return any(
        c["type"] == "encrypted" and c["status"] == "pending"
        for c in build_access_check(post, request.user)["conditions"]
    )


def post_requires_condition(request, post):
    check = build_access_check(post, request.user)
    if check["all_granted"]:
        return False
    return not any(
        c["type"] == "encrypted" and c["status"] == "pending"
        for c in check["conditions"]
    )


def get_post_condition_access_state(request, post):
    check = build_access_check(post, request.user)
    money_condition = next((c for c in check["conditions"] if c["type"] == "money"), {})
    points_condition = next((c for c in check["conditions"] if c["type"] == "points"), {})
    return {
        "status": "granted" if check["all_granted"] else (
            "purchase_required" if money_condition.get("action") == "purchase"
            else money_condition.get("status", "granted")
        ),
        "money_required": money_condition.get("requirement"),
        "points_required": points_condition.get("requirement"),
        "has_purchase": money_condition.get("status") == "granted" if money_condition.get("type") == "money" else False,
    }


__all__ = [
    "can_access_post",
    "can_add_post_to_book",
    "get_book_post_access_state",
    "get_post_condition_access_state",
    "post_requires_condition",
    "post_requires_password",
]
