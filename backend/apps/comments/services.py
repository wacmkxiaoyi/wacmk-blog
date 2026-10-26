from django.db.models import CharField, Count, Prefetch, Q, Value
from rest_framework.exceptions import PermissionDenied

from apps.authorization_core.application.user_identity_service import UserIdentityService
from apps.resources.access.application.resource_check_service import ResourceCheckService
from apps.resources.models import Article, Book
from apps.resources.serializers import list_article_ids
from apps.site_settings.application.settings_service import SiteSettingsService

from .models import ArticleComment, CommentReaction
from .serializers import CommentParticipantSerializer


def get_article(slug):
    return Article.objects.select_related("author").get(slug=slug)


def validate_article_access(article, user, book_id=None):
    book_context = False
    if book_id:
        try:
            book = Book.objects.get(pk=book_id)
        except Book.DoesNotExist:
            raise PermissionDenied("Book context is unavailable.")
        if article.pk not in list_article_ids(book.structure):
            raise PermissionDenied("The article is not part of this book.")
        if not ResourceCheckService.build_access_check(book, user, resource_type="book").all_granted:
            raise PermissionDenied("Book access is required.")
        book_context = True
    if not ResourceCheckService.build_access_check(article, user, resource_type="article", book_context=book_context).all_granted:
        raise PermissionDenied("Article access is required.")


def require_comment_permission(article, user):
    if not user.is_authenticated:
        raise PermissionDenied("Authentication is required to comment.")
    if user.is_staff or user.is_superuser:
        return
    config = SiteSettingsService.get_all()["comment"]
    identity = UserIdentityService.resolve(user)
    if not config.get("allow_user_comment", False):
        raise PermissionDenied("Comments are disabled.")
    if config.get("vip_only", False) and not identity.is_vip:
        raise PermissionDenied("VIP membership is required to comment.")


def annotated_threads(article, user):
    annotations = {
        "upvoteCount": Count("reactions", filter=Q(reactions__vote="up")),
        "downvoteCount": Count("reactions", filter=Q(reactions__vote="down")),
        "viewerVote": Value(None, output_field=CharField()),
    }
    replies = ArticleComment.objects.filter(parent__isnull=False).select_related("author", "reply_to__author").annotate(**annotations).order_by("created_at", "pk")
    if user.is_authenticated:
        replies = replies.prefetch_related(Prefetch("reactions", queryset=CommentReaction.objects.filter(user=user), to_attr="viewer_reactions"))
    roots = ArticleComment.objects.filter(article=article, parent__isnull=True).select_related("author", "reply_to__author").annotate(**annotations).prefetch_related(Prefetch("replies", queryset=replies, to_attr="thread_replies")).order_by("-created_at", "-pk")
    if user.is_authenticated:
        roots = roots.prefetch_related(Prefetch("reactions", queryset=CommentReaction.objects.filter(user=user), to_attr="viewer_reactions"))
    return roots


def apply_viewer_votes(comments, user):
    for comment in comments:
        reactions = getattr(comment, "viewer_reactions", [])
        comment.viewerVote = reactions[0].vote if reactions else None
        for reply in getattr(comment, "thread_replies", []):
            reactions = getattr(reply, "viewer_reactions", [])
            reply.viewerVote = reactions[0].vote if reactions else None
    return comments


def serialize_participants(comments, request):
    users = {}
    for comment in comments:
        users[comment.author_id] = comment.author
        if comment.reply_to_id:
            users[comment.reply_to.author_id] = comment.reply_to.author
        for reply in getattr(comment, "thread_replies", []):
            users[reply.author_id] = reply.author
            if reply.reply_to_id:
                users[reply.reply_to.author_id] = reply.reply_to.author
    identities = {user_id: UserIdentityService.resolve(user) for user_id, user in users.items()}
    vip_names = {
        index: str(item.get("display_name") or f"VIP {index}")
        for index, item in enumerate(SiteSettingsService.get_all()["vip"].get("vip_configs", []), start=1)
        if isinstance(item, dict)
    }
    return {
        str(user_id): CommentParticipantSerializer(user, context={"request": request, "identities": identities, "vip_names": vip_names}).data
        for user_id, user in users.items()
    }
