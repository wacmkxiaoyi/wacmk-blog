import json
from urllib.parse import urlencode

from apps.blog.models import Post
from apps.blog.visibility import get_post_access_display, get_post_condition_summary_items, get_post_visibility_presentation, post_has_encrypted_access, post_has_value_conditions, post_is_book_only


def get_book_structure_post_ids(structure):
    post_ids = []
    for item in structure or []:
        if not isinstance(item, dict):
            continue
        if item.get("type") == "post" and item.get("post_id"):
            post_ids.append(int(item["post_id"]))
        elif item.get("type") == "group":
            post_ids.extend(get_book_structure_post_ids(item.get("children") or []))
    return post_ids


def prune_book_structure_missing_posts(structure, existing_post_ids):
    normalized_existing_ids = {int(post_id) for post_id in (existing_post_ids or [])}

    def prune_nodes(items):
        pruned = []
        changed = False
        for item in items or []:
            if not isinstance(item, dict):
                changed = True
                continue
            node_type = item.get("type")
            if node_type == "post":
                post_id = item.get("post_id")
                if not post_id:
                    changed = True
                    continue
                post_id = int(post_id)
                if post_id not in normalized_existing_ids:
                    changed = True
                    continue
                pruned.append({"type": "post", "post_id": post_id})
                continue
            if node_type == "group":
                children, child_changed = prune_nodes(item.get("children") or [])
                title = (item.get("title") or "").strip()
                if not title:
                    changed = True
                    continue
                if not children:
                    changed = True
                    continue
                pruned.append({"type": "group", "title": title, "children": children})
                changed = changed or child_changed
                continue
            changed = True
        return pruned, changed

    return prune_nodes(structure or [])


def remove_post_from_book_structure(structure, post_id):
    return prune_book_structure_missing_posts(structure, set(get_book_structure_post_ids(structure)) - {int(post_id)})


def can_display_post_in_book_navigation(post, user, *, is_share_view=False):
    if post.status != Post.STATUS_PUBLISHED:
        return False
    if post.visibility == Post.VISIBILITY_PUBLIC:
        return True
    if post_is_book_only(post):
        return True if is_share_view else bool(user.is_authenticated)
    if is_share_view:
        return False
    return bool(
        user.is_authenticated
        and (
            user.is_staff
            or user.is_superuser
            or post.author_id == user.pk
            or post_has_encrypted_access(post)
            or post_has_value_conditions(post)
        )
    )


def build_book_navigation_tree(book, request, *, current_post=None, is_share_view=False, base_url=None):
    structure_ids = get_book_structure_post_ids(book.structure)
    navigation_base_url = (base_url or book.get_absolute_url()).strip() or book.get_absolute_url()
    post_map = {
        post.pk: post
        for post in Post.objects.filter(pk__in=structure_ids, status=Post.STATUS_PUBLISHED).select_related("author")
    }

    def build_nodes(items):
        nodes = []
        for item in items or []:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "post":
                post = post_map.get(int(item.get("post_id") or 0))
                if post is None or not can_display_post_in_book_navigation(post, request.user, is_share_view=is_share_view):
                    continue
                nodes.append(
                    {
                        "access_display": get_post_access_display(post),
                        "type": "post",
                        "post": post,
                        "title": post.title,
                        "url": f"{navigation_base_url}?{urlencode({'post': post.slug})}",
                        "is_current": bool(current_post and current_post.pk == post.pk),
                        "is_book_only": post_is_book_only(post),
                        "is_private": post.visibility == Post.VISIBILITY_PRIVATE,
                        "is_encrypted": post_has_encrypted_access(post),
                        "is_conditional": post_has_value_conditions(post),
                        "condition_summary_items": get_post_condition_summary_items(post),
                        "visibility_presentation": get_post_visibility_presentation(post),
                    }
                )
                continue
            if item.get("type") == "group":
                children = build_nodes(item.get("children") or [])
                if not children:
                    continue
                nodes.append(
                    {
                        "type": "group",
                        "title": (item.get("title") or "").strip(),
                        "children": children,
                    }
                )
        return nodes

    return build_nodes(book.structure or [])


def dump_book_navigation_tree(nodes):
    def serialize(items):
        payload = []
        for item in items:
            if item["type"] == "group":
                payload.append(
                    {
                        "type": "group",
                        "title": item["title"],
                        "children": serialize(item.get("children") or []),
                    }
                )
                continue
            payload.append(
                {
                    "type": "post",
                    "title": item["title"],
                    "url": item["url"],
                    "isCurrent": item["is_current"],
                    "accessDisplay": item.get("access_display") or None,
                    "isPrivate": item["is_private"],
                    "isEncrypted": item["is_encrypted"],
                    "isConditional": item.get("is_conditional", False),
                    "visibilityPresentation": item.get("visibility_presentation") or {"type": "public"},
                }
            )
        return payload

    return json.dumps(serialize(nodes), ensure_ascii=False)


def get_first_visible_book_post(book, request, *, is_share_view=False):
    navigation = build_book_navigation_tree(book, request, is_share_view=is_share_view)

    def walk(nodes):
        for node in nodes:
            if node["type"] == "post":
                return node["post"]
            child = walk(node.get("children") or [])
            if child is not None:
                return child
        return None

    return walk(navigation)


__all__ = [name for name in globals() if not name.startswith("_")]
