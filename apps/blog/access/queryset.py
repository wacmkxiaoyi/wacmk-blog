from django.db.models import Q

from apps.blog.models import Book, Post
from .vip_check import check_is_vip_user


def build_vip_standalone_q(model_cls, user):
    if not user or not getattr(user, "is_authenticated", False):
        return Q()
    if not check_is_vip_user(user):
        return Q()
    author_field = "author_id" if hasattr(model_cls, "author_id") else "created_by_id"
    exclude = {author_field: getattr(user, "pk", None)}
    return Q(
        access_scope=model_cls.ACCESS_SCOPE_STANDALONE,
        vip_access_permission__in=[model_cls.VISIBILITY_PUBLIC, model_cls.VISIBILITY_CONDITIONAL],
    ) & ~Q(**exclude)


def build_visible_queryset_q(model_cls, user):
    if not user or not user.is_authenticated:
        return Q(visibility=model_cls.VISIBILITY_PUBLIC)

    author_field = "author_id" if hasattr(model_cls, "author_id") else "created_by_id"

    q = Q(visibility__in=[model_cls.VISIBILITY_PUBLIC, model_cls.VISIBILITY_CONDITIONAL]) | Q(
        **{author_field: getattr(user, "pk", None)}
    )

    vip_q = build_vip_standalone_q(model_cls, user)
    if vip_q:
        q = q | vip_q

    return q


def get_visible_book_queryset(user):
    queryset = Book.objects.select_related("created_by")
    if user.is_staff or user.is_superuser:
        return queryset
    q = build_visible_queryset_q(Book, user)
    return queryset.filter(q).distinct()


def get_detail_book_queryset(user):
    return get_visible_book_queryset(user)


def get_visible_post_queryset(user):
    from apps.blog.models import Post
    from apps.blog.permissions import CONDITION_TYPE_BOOK_ONLY, has_condition_rule

    queryset = Post.objects.select_related("author").prefetch_related("tags", "books")
    if user.is_staff or user.is_superuser:
        return queryset

    q = build_visible_queryset_q(Post, user) & Q(status=Post.STATUS_PUBLISHED)
    queryset = queryset.filter(q).distinct()

    visible_ids = []
    for post in queryset:
        if has_condition_rule(post.condition_rules, CONDITION_TYPE_BOOK_ONLY):
            if post.author_id != getattr(user, "pk", None):
                continue
        visible_ids.append(post.pk)
    return queryset.filter(pk__in=visible_ids)


def get_reference_post_queryset(user):
    from apps.blog.models import Post

    queryset = Post.objects.select_related("author").prefetch_related("tags", "books").filter(
        status=Post.STATUS_PUBLISHED
    )
    if user.is_staff or user.is_superuser:
        return queryset
    if not user.is_authenticated:
        return queryset.none()

    q = build_visible_queryset_q(Post, user)
    return queryset.filter(q).distinct()


def get_detail_post_queryset(user):
    from apps.blog.models import Post

    queryset = Post.objects.select_related("author").prefetch_related("tags", "books").filter(
        status=Post.STATUS_PUBLISHED
    )
    if user.is_staff or user.is_superuser:
        return queryset
    if not user.is_authenticated:
        return queryset.filter(visibility=Post.VISIBILITY_PUBLIC)

    is_vip = check_is_vip_user(user)
    author_private = Q(
        visibility__in=[Post.VISIBILITY_PUBLIC, Post.VISIBILITY_PRIVATE, Post.VISIBILITY_CONDITIONAL],
        author=user,
    )
    public_q = Q(visibility__in=[Post.VISIBILITY_PUBLIC, Post.VISIBILITY_CONDITIONAL])

    if is_vip:
        vip_q = build_vip_standalone_q(Post, user)
        return queryset.filter(author_private | public_q | vip_q).distinct()

    return queryset.filter(author_private | public_q).distinct()


__all__ = [
    "build_vip_standalone_q",
    "build_visible_queryset_q",
    "get_detail_book_queryset",
    "get_detail_post_queryset",
    "get_reference_post_queryset",
    "get_visible_book_queryset",
    "get_visible_post_queryset",
]
