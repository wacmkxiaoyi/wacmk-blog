from apps.blog.access import build_access_check


def can_access_book(request, book):
    return build_access_check(book, request.user)["all_granted"]


def get_book_condition_access_state(request, book):
    check = build_access_check(book, request.user)
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


__all__ = ["can_access_book", "get_book_condition_access_state"]
