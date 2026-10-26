import re

from django.core import signing
from django.core.files.storage import default_storage
from django.db import transaction
from django.http import Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.resources.access.application.resource_check_service import ResourceCheckService
from apps.resources.models import Article, Attachment, MediaAsset, MediaAssetReference
from apps.resources.views import book_context_for_article
from apps.authorization_core.application.user_identity_service import UserIdentityService
from apps.authorization_core.application.vip_service import VipService
from apps.site_settings.application.settings_service import SiteSettingsService
from apps.users.models import User, UserMoneyChangeLog, UserPointsChangeLog

from .models import ArticleComment, CommentReaction
from .serializers import ArticleCommentSerializer, CreateCommentSerializer, ReactionSerializer, UpdateCommentSerializer
from .services import annotated_threads, apply_viewer_votes, get_article, require_comment_permission, serialize_participants, validate_article_access


ASSET_ID_RE = re.compile(r'assetId="([0-9a-fA-F-]{36})"')


def award_first_comment_reward(comment, user):
    """Award the configured site and VIP rewards for a user's first article comment."""
    settings = SiteSettingsService.get_all()["comment"]
    benefits = VipService.get_benefits(UserIdentityService.resolve(user).vip_level)
    money = max(int(settings.get("first_reward_money", 0)), 0) + benefits["first_comment_bonus_money"]
    points = max(int(settings.get("first_reward_points", 0)), 0) + benefits["first_comment_bonus_points"]
    if money:
        user.money_balance += money
        UserMoneyChangeLog.objects.create(
            user=user,
            change_amount=money,
            balance_after=user.money_balance,
            reason_type=UserMoneyChangeLog.REASON_FIRST_COMMENT_REWARD,
            related_object_type="comment",
            related_object_id=comment.pk,
        )
    if points:
        user.points_balance += points
        UserPointsChangeLog.objects.create(
            user=user,
            change_amount=points,
            balance_after=user.points_balance,
            reason_type=UserPointsChangeLog.REASON_FIRST_COMMENT_REWARD,
            related_object_type="comment",
            related_object_id=comment.pk,
        )
    if money or points:
        user.save(update_fields=("money_balance", "points_balance"))


def sync_comment_assets(comment, user):
    asset_ids = set(ASSET_ID_RE.findall(comment.content or ""))
    assets = list(MediaAsset.objects.filter(
        pk__in=asset_ids,
        uploaded_by=user,
        status=MediaAsset.STATUS_READY,
    ))
    if {str(asset.pk) for asset in assets} != asset_ids:
        raise PermissionDenied("Comment content references unavailable media assets.")
    for asset in assets:
        target = f"content-assets/user-{comment.article.author_id}/articles/{comment.article_id}/{asset.pk}"
        if asset.file.name == target:
            continue
        source = asset.file.name
        with asset.file.open("rb") as file:
            saved_name = default_storage.save(target, file)
        asset.file.name = saved_name
        asset.storage_key = saved_name
        asset.save(update_fields=("file", "storage_key", "updated_at"))
        if source and default_storage.exists(source):
            default_storage.delete(source)
    MediaAssetReference.objects.filter(
        resource_type="comment",
        resource_id=comment.pk,
    ).exclude(asset__in=assets).delete()
    MediaAssetReference.objects.bulk_create(
        [
            MediaAssetReference(asset=asset, resource_type="comment", resource_id=comment.pk)
            for asset in assets
        ],
        ignore_conflicts=True,
    )


def comment_asset_manifest(request, article, asset_ids, attachment_ids):
    if not isinstance(asset_ids, list) or len(asset_ids) > 100:
        raise PermissionDenied("assetIds must contain at most 100 asset IDs.")
    if not isinstance(attachment_ids, list) or len(attachment_ids) > 100:
        raise PermissionDenied("attachmentIds must contain at most 100 attachment IDs.")
    assets = MediaAsset.objects.filter(
        pk__in=asset_ids,
        status=MediaAsset.STATUS_READY,
        references__resource_type="comment",
        references__resource_id__in=article.comments.values("pk"),
    ).distinct()
    attachments = Attachment.objects.filter(pk__in=attachment_ids, asset__in=assets).select_related("asset")
    attachments_by_asset = {}
    for attachment in attachments:
        attachments_by_asset.setdefault(attachment.asset_id, []).append(attachment)
    book_context = book_context_for_article(request, article)
    result = {}
    for asset in assets:
        selected = attachments_by_asset.get(asset.pk) or list(asset.attachments.all()[:1])
        if asset.kind != MediaAsset.KIND_ATTACHMENT or not selected:
            token = signing.dumps({"asset_id": str(asset.pk), "disposition": "inline"}, salt="resources.media-delivery")
            result[str(asset.pk)] = {
                "kind": asset.kind,
                "state": "available",
                "filename": asset.original_filename,
                "mediaType": asset.media_type,
                "size": asset.file_size,
                "inlineUrl": request.build_absolute_uri(f"/api/resources/media-delivery/{token}/"),
            }
            continue
        for attachment in selected:
            decision = ResourceCheckService.build_access_check(
                attachment,
                request.user,
                resource_type="attachment",
                book_context=book_context,
            ).to_dict()
            result[str(attachment.pk) if str(attachment.pk) in attachment_ids else str(asset.pk)] = {
                "kind": asset.kind,
                "state": "available",
                "filename": asset.original_filename,
                "mediaType": asset.media_type,
                "size": asset.file_size,
                "attachmentId": attachment.pk,
                "title": attachment.title,
                "extension": attachment.file_ext,
                "sizeLabel": f"{attachment.file_size / 1024:.1f} KB",
                "downloadCount": attachment.download_count,
                "visibility": attachment.visibility,
                "conditionRules": attachment.condition_rules,
                "accessScope": attachment.access_scope,
                "vipAccessPermission": attachment.vip_access_permission,
                "vipConditionRules": attachment.vip_condition_rules,
                "accessDecision": decision,
                "downloadState": "granted" if decision["all_granted"] else "restricted",
            }
    return result


def request_book_id(request):
    value = request.query_params.get("bookId") or request.data.get("bookId")
    try:
        return int(value) if value else None
    except (TypeError, ValueError):
        raise PermissionDenied("Invalid book context.")


class ArticleCommentsView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request, slug):
        try:
            article = get_article(slug)
        except Article.DoesNotExist as exc:
            raise Http404 from exc
        validate_article_access(article, request.user, request_book_id(request))
        try:
            page_size = min(50, max(1, int(request.query_params.get("page_size", 20))))
            offset = max(0, int(request.query_params.get("offset", 0)))
        except ValueError:
            page_size, offset = 20, 0
        threads = list(annotated_threads(article, request.user))
        items = apply_viewer_votes(threads[offset:offset + page_size], request.user)
        return Response({"items": ArticleCommentSerializer(items, many=True, context={"request": request}).data, "participants": serialize_participants(items, request), "hasMore": offset + page_size < len(threads), "nextOffset": offset + page_size if offset + page_size < len(threads) else None, "totalRootCount": len(threads)})

    def post(self, request, slug):
        try:
            article = get_article(slug)
        except Article.DoesNotExist as exc:
            raise Http404 from exc
        validate_article_access(article, request.user, request_book_id(request))
        require_comment_permission(article, request.user)
        serializer = CreateCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        parent_id = serializer.validated_data.get("parentId")
        reply_to_id = serializer.validated_data.get("replyToId")
        parent = reply_to = None
        if parent_id:
            parent = ArticleComment.objects.filter(pk=parent_id, article=article, parent__isnull=True).first()
            if not parent:
                raise PermissionDenied("Reply parent is unavailable.")
            reply_to = ArticleComment.objects.filter(pk=reply_to_id or parent_id, article=article).first()
            if not reply_to or (reply_to.pk != parent.pk and reply_to.parent_id != parent.pk):
                raise PermissionDenied("Reply target is unavailable.")
        elif reply_to_id:
            raise PermissionDenied("A reply target requires a parent thread.")
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            is_first_comment = not ArticleComment.objects.filter(
                article=article,
                author=user,
            ).exists()
            comment = ArticleComment.objects.create(article=article, author=user, parent=parent, reply_to=reply_to, content=serializer.validated_data["content"])
            sync_comment_assets(comment, user)
            if is_first_comment:
                award_first_comment_reward(comment, user)
        comment.upvoteCount = comment.downvoteCount = 0
        comment.viewerVote = None
        return Response({"item": ArticleCommentSerializer(comment, context={"request": request}).data, "participants": serialize_participants([comment], request)}, status=status.HTTP_201_CREATED)


class ArticleCommentDetailView(APIView):
    def get_comment(self, slug, comment_id):
        try:
            return get_article(slug), ArticleComment.objects.select_related("author", "reply_to__author").get(pk=comment_id, article__slug=slug)
        except (ArticleComment.DoesNotExist,):
            raise Http404

    def patch(self, request, slug, comment_id):
        article, comment = self.get_comment(slug, comment_id)
        validate_article_access(article, request.user, request_book_id(request))
        if not request.user.is_authenticated or comment.is_deleted or (request.user.pk != comment.author_id and not request.user.is_staff and not request.user.is_superuser):
            raise PermissionDenied()
        serializer = UpdateCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment.content = serializer.validated_data["content"]
        with transaction.atomic():
            comment.save(update_fields=("content", "updated_at"))
            sync_comment_assets(comment, request.user)
        comment.upvoteCount = comment.downvoteCount = 0
        comment.viewerVote = None
        return Response({"item": ArticleCommentSerializer(comment, context={"request": request}).data, "participants": serialize_participants([comment], request)})

    def delete(self, request, slug, comment_id):
        article, comment = self.get_comment(slug, comment_id)
        validate_article_access(article, request.user, request_book_id(request))
        if not request.user.is_authenticated or comment.is_deleted or (request.user.pk != comment.author_id and not request.user.is_staff and not request.user.is_superuser):
            raise PermissionDenied()
        comment.is_deleted = True
        comment.content = ""
        comment.deleted_at = timezone.now()
        with transaction.atomic():
            comment.save(update_fields=("is_deleted", "content", "deleted_at", "updated_at"))
            MediaAssetReference.objects.filter(resource_type="comment", resource_id=comment.pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ArticleCommentAssetManifestView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request, slug):
        try:
            article = get_article(slug)
        except Article.DoesNotExist as exc:
            raise Http404 from exc
        validate_article_access(article, request.user, request_book_id(request))
        return Response({
            "assets": comment_asset_manifest(
                request,
                article,
                request.data.get("assetIds", []),
                request.data.get("attachmentIds", []),
            ),
        })


class ArticleCommentAttachmentDownloadView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request, slug, asset_id):
        try:
            article = get_article(slug)
            asset = MediaAsset.objects.get(
                pk=asset_id,
                kind=MediaAsset.KIND_ATTACHMENT,
                status=MediaAsset.STATUS_READY,
            )
        except (Article.DoesNotExist, MediaAsset.DoesNotExist) as exc:
            raise Http404 from exc
        validate_article_access(article, request.user, request_book_id(request))
        attachment = asset.attachments.filter(pk=request.data.get("attachmentId")).first()
        is_referenced = asset.references.filter(
            resource_type="comment",
            resource_id__in=article.comments.values("pk"),
        ).exists()
        book_context = book_context_for_article(request, article)
        if not attachment or not is_referenced or not ResourceCheckService.build_access_check(
            attachment,
            request.user,
            resource_type="attachment",
            book_context=book_context,
        ).all_granted:
            raise PermissionDenied("Attachment access is required.")
        token = signing.dumps(
            {"asset_id": str(asset.pk), "attachment_id": attachment.pk, "disposition": "attachment"},
            salt="resources.media-delivery",
        )
        return Response({"url": request.build_absolute_uri(f"/api/resources/media-delivery/{token}/"), "expiresAt": 300})


class CommentReactionView(APIView):
    def put(self, request, slug, comment_id):
        article, comment = ArticleCommentDetailView().get_comment(slug, comment_id)
        validate_article_access(article, request.user, request_book_id(request))
        if not request.user.is_authenticated or comment.is_deleted:
            raise PermissionDenied()
        serializer = ReactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vote = serializer.validated_data["vote"]
        with transaction.atomic():
            if vote is None:
                CommentReaction.objects.filter(comment=comment, user=request.user).delete()
            else:
                CommentReaction.objects.update_or_create(comment=comment, user=request.user, defaults={"vote": vote})
        up_count = CommentReaction.objects.filter(comment=comment, vote="up").count()
        down_count = CommentReaction.objects.filter(comment=comment, vote="down").count()
        return Response({"commentId": str(comment.pk), "upvoteCount": up_count, "downvoteCount": down_count, "viewerVote": vote})
