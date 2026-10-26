import mimetypes

from django.core import signing
from django.core.cache import cache
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone
from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .access.application.resource_check_service import ResourceCheckService
from .access.application.handler_resolver import HandlerResolver
from .access.application.subject_factory import SubjectFactory
from .article_reuse import can_reuse_article, import_article_as_draft, reusable_articles
from .article_permissions import require_article_write_permission
from .book_permissions import require_book_write_permission

from .interactions import attach_interactions, set_star, set_vote
from .models import Article, ArticleDraft, Attachment, Book, MediaAsset, ResourceStar
from .external_links import clear_external_link, is_book_external_link_active, is_book_external_link_eligible, is_external_link_active, is_external_link_eligible, rotate_book_external_link, rotate_external_link, set_external_link_expiry
from .media_lifecycle import delete_article, delete_article_draft, delete_attachment, delete_book, promote_revision_cover, schedule_unreferenced_cover_cleanup
from .serializers import ArticleDraftSerializer, ArticleSerializer, AttachmentSerializer, BookSerializer, ManagedArticleDraftSerializer, ManagedArticleSerializer, ManagedBookSerializer, list_article_ids
from .services import validate_upload
from .zinc_search_apis import ZincSearchError, get_article_document, index_article, search_article_ids, search_book_ids
from apps.authorization_core.application.user_identity_service import UserIdentityService
from apps.dashboard.services import record_content_view
from apps.site_settings.application.audit_service import AuditLogService
from apps.site_settings.application.settings_service import SiteSettingsService
from apps.site_settings.infrastructure.views import IsSiteManager
from apps.tags.models import Tag
from apps.users.services.storage import ensure_user_storage_capacity


def can_manage(user, resource):
    if user.is_staff or user.is_superuser:
        return True
    for field_name in ("author_id", "created_by_id", "uploaded_by_id"):
        if hasattr(resource, field_name):
            return getattr(resource, field_name) == user.id
    return False


def visible(resource, user, resource_type, *, book_context=False):
    return ResourceCheckService.build_access_check(resource, user, resource_type=resource_type, book_context=book_context).all_granted


def can_discover(resource, user):
    return resource.visibility != "private" or can_manage(user, resource)


def list_options(request):
    try:
        page = max(1, int(request.query_params.get("page", 1)))
        page_size = min(50, max(1, int(request.query_params.get("pageSize", 12))))
    except ValueError:
        page, page_size = 1, 12
    sort = request.query_params.get("sort", "starred")
    return page, page_size, sort if sort in {"starred", "latest"} else "starred"


def cached_search_ids(resource_type, query, search):
    """Cache ZincSearch rankings only; resource visibility stays in MySQL."""
    normalized_query = query.strip().lower()
    key = f"zinc-search:{resource_type}:{normalized_query}"
    ids = cache.get(key)
    if ids is None:
        ids = search(query)
        cache.set(key, ids, settings.ZINC_SEARCH_QUERY_CACHE_TTL_SECONDS)
    return ids


def search_cursor(request):
    try:
        return max(0, int(request.query_params.get("cursor", 0)))
    except (TypeError, ValueError):
        return 0


def cannot_open_from_listing(resource, user, resource_type):
    """Hide only resources whose effective channel can never open from this page."""
    subject = SubjectFactory.build(resource, resource_type=resource_type)
    identity = UserIdentityService.resolve(user)
    handler = HandlerResolver.resolve(subject, identity)
    if handler.has_bypass_access(identity):
        return False
    if handler.visibility == "private":
        return True
    return resource_type == "article" and any(rule.type == "book_only" for rule in handler.condition_rules)


def cursor_search_response(ids, cursor, page_size, load_batch, can_include, serializer):
    """Scan ranked Zinc IDs in bounded MySQL batches until a visible page is full."""
    items = []
    position = min(cursor, len(ids))
    batch_size = max(page_size * 2, settings.ZINC_SEARCH_CURSOR_SCAN_BATCH_SIZE)
    while position < len(ids) and len(items) < page_size:
        candidate_ids = ids[position:position + batch_size]
        loaded = {item.pk: item for item in load_batch(candidate_ids)}
        for resource_id in candidate_ids:
            position += 1
            resource = loaded.get(resource_id)
            if resource is not None and can_include(resource):
                items.append(resource)
                if len(items) == page_size:
                    break
    return Response({
        "items": serializer(items, many=True).data,
        "pageSize": page_size,
        "cursor": cursor,
        "nextCursor": position if position < len(ids) else None,
        "hasMore": position < len(ids),
    })


def paginated_response(items, total, page, page_size, serializer):
    total_pages = max(1, (total + page_size - 1) // page_size) if total else 0
    page = min(page, total_pages) if total_pages else 1
    start = (page - 1) * page_size
    return Response({"items": serializer(items[start:start + page_size], many=True).data, "total": total, "page": page, "pageSize": page_size, "totalPages": total_pages})


def database_list_response(queryset, request, resource_type, serializer):
    page, page_size, sort = list_options(request)
    model = queryset.model
    if not (request.user.is_staff or request.user.is_superuser):
        queryset = queryset.exclude(model.invisible_conditions(request.user))
    if sort == "starred" and request.user.is_authenticated:
        from django.db.models import Case, DateTimeField, OuterRef, Subquery, Value, When
        starred_at = ResourceStar.objects.filter(resource_type=resource_type, resource_id=OuterRef("pk"), user=request.user).values("created_at")[:1]
        queryset = queryset.annotate(_starred_at=Subquery(starred_at, output_field=DateTimeField())).order_by(Case(When(_starred_at__isnull=False, then=Value(0)), default=Value(1)), "-_starred_at", "-published_at" if resource_type == "article" else "-updated_at", "-pk")
    else:
        queryset = queryset.order_by("-published_at" if resource_type == "article" else "-updated_at", "-pk")
    total = queryset.count()
    items = attach_interactions(queryset[(page - 1) * page_size:page * page_size], request.user, resource_type)
    total_pages = max(1, (total + page_size - 1) // page_size) if total else 0
    return Response({"items": serializer(items, many=True).data, "total": total, "page": min(page, total_pages) if total_pages else 1, "pageSize": page_size, "totalPages": total_pages})


class ReusableArticleListView(APIView):
    permission_classes = (AllowAny,)
    permission = None

    def get(self, request):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        query = (request.query_params.get("query") or "").strip()
        page, page_size, _ = list_options(request)
        articles = reusable_articles(request.user, self.permission, query)
        return paginated_response(articles, len(articles), page, page_size, lambda values, many: ArticleSerializer(values, many=many, context={"request": request}))


class ArticleReferenceListView(ReusableArticleListView):
    permission = "allow_quote"


class ArticleImportListView(ReusableArticleListView):
    permission = "allow_reprint"


class ArticleImportView(APIView):
    def post(self, request):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        require_article_write_permission(request.user, creating=True)
        try:
            article = Article.objects.prefetch_related("tags").get(pk=request.data.get("article_id"))
        except (Article.DoesNotExist, TypeError, ValueError) as exc:
            raise Http404 from exc
        if not can_reuse_article(article, request.user, "allow_reprint"):
            raise PermissionDenied("Article import is not permitted.")
        try:
            with transaction.atomic():
                draft = import_article_as_draft(article, request.user)
        except ValueError as exc:
            raise ValidationError({"article_id": str(exc)}) from exc
        return Response(ArticleDraftSerializer(draft, context={"request": request}).data, status=status.HTTP_201_CREATED)


def require_access(request, resource, resource_type):
    if not request.user.is_authenticated or not visible(resource, request.user, resource_type):
        raise PermissionDenied("Resource access is required.")


def book_context_for_article(request, article):
    book_id = request.query_params.get("bookId") or request.data.get("bookId")
    if not book_id:
        return False
    try:
        book = Book.objects.get(pk=int(book_id))
    except (Book.DoesNotExist, TypeError, ValueError):
        raise PermissionDenied("Book context is unavailable.")
    if article.pk not in list_article_ids(book.structure) or not visible(book, request.user, "book"):
        raise PermissionDenied("Book access is required.")
    return True


def image_response(field):
    response = FileResponse(field.open("rb"))
    response["Content-Type"] = mimetypes.guess_type(str(getattr(field, "name", "")))[0] or "application/octet-stream"
    response["X-Content-Type-Options"] = "nosniff"
    response["Referrer-Policy"] = "no-referrer"
    return response


class ArticleListView(APIView):
    permission_classes = (AllowAny,)
    parser_classes = (JSONParser, FormParser, MultiPartParser)
    def get(self, request):
        query = (request.query_params.get("query") or "").strip()
        page, page_size, sort = list_options(request)
        articles = Article.objects.select_related("author").prefetch_related("tags")
        ids = [value for value in (request.query_params.get("ids") or "").split(",") if value.isdigit()]
        if ids:
            articles = articles.filter(pk__in=ids)
        book_id = request.query_params.get("bookId")
        if book_id:
            try:
                book = Book.objects.get(pk=int(book_id))
            except (Book.DoesNotExist, TypeError, ValueError) as exc:
                raise PermissionDenied("Book context is unavailable.") from exc
            if not visible(book, request.user, "book"):
                raise PermissionDenied("Book access is required.")
            article_ids = list_article_ids(book.structure)
            articles = articles.filter(pk__in=article_ids)
            if not (request.user.is_staff or request.user.is_superuser):
                articles = articles.exclude(Q(visibility=Article.VISIBILITY_PRIVATE) & ~Q(author=request.user))
            items = list(attach_interactions(articles, request.user, "article"))
            payload = ArticleSerializer(
                items,
                many=True,
                context={"request": request, "include_content": False},
            ).data
            for item, article in zip(payload, items):
                item["accessDecision"] = ResourceCheckService.build_access_check(
                    article,
                    request.user,
                    resource_type="article",
                    book_context=True,
                ).to_dict()
            return Response({"items": payload, "total": len(payload), "page": 1, "pageSize": len(payload), "totalPages": 1 if payload else 0})
        tag = (request.query_params.get("tag") or "").strip()
        search_ids = None
        if query:
            try:
                search_ids = cached_search_ids("articles", query, search_article_ids)
            except ZincSearchError as exc:
                raise ValidationError({"detail": str(exc)}) from exc
            cursor = search_cursor(request)
            tag_name = tag

            def load_batch(candidate_ids):
                queryset = Article.objects.filter(pk__in=candidate_ids).select_related("author").prefetch_related("tags")
                if tag_name:
                    queryset = queryset.filter(tags__name__iexact=tag_name)
                return attach_interactions(queryset, request.user, "article")

            return cursor_search_response(
                search_ids,
                cursor,
                page_size,
                load_batch,
                lambda article: request.user.is_staff or request.user.is_superuser or not cannot_open_from_listing(article, request.user, "article"),
                lambda values, many: ArticleSerializer(values, many=many, context={"request": request, "include_content": False}),
            )
        if tag:
            articles = articles.filter(tags__name__iexact=tag)
        articles = articles.distinct()
        return database_list_response(articles, request, "article", lambda values, many: ArticleSerializer(values, many=many, context={"request": request, "include_content": False}))

    def post(self, request):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        require_article_write_permission(request.user, creating=True)
        serializer = ArticleSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ArticleDetailView(APIView):
    permission_classes = (AllowAny,)
    parser_classes = (JSONParser, FormParser, MultiPartParser)
    def get_object(self, slug):
        try:
            return Article.objects.select_related("author").prefetch_related("tags").get(slug=slug)
        except Article.DoesNotExist as exc:
            raise Http404 from exc

    def get(self, request, slug):
        article = self.get_object(slug)
        if not visible(article, request.user, "article", book_context=book_context_for_article(request, article)):
            raise PermissionDenied("Article access is required.")
        record_content_view(request, article, "article")
        attach_interactions([article], request.user, "article")
        return Response(ArticleSerializer(article, context={"request": request}).data)

    def patch(self, request, slug):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        article = self.get_object(slug)
        if not can_manage(request.user, article):
            raise PermissionDenied()
        require_article_write_permission(request.user)
        serializer = ArticleSerializer(article, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return Response(ArticleSerializer(serializer.save(), context={"request": request}).data)

    def delete(self, request, slug):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        article = self.get_object(slug)
        if not can_manage(request.user, article):
            raise PermissionDenied()
        delete_article(article)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ArticleViewView(APIView):
    """Record a rendered published article without exposing tracking failures."""
    permission_classes = (AllowAny,)

    def post(self, request, slug):
        try:
            article = Article.objects.get(slug=slug)
        except Article.DoesNotExist:
            return Response(status=status.HTTP_204_NO_CONTENT)

        book = None
        book_id = request.data.get("bookId")
        if book_id:
            try:
                book = Book.objects.get(pk=int(book_id))
            except (Book.DoesNotExist, TypeError, ValueError):
                return Response(status=status.HTTP_204_NO_CONTENT)
            if article.pk not in list_article_ids(book.structure) or not visible(book, request.user, "book"):
                return Response(status=status.HTTP_204_NO_CONTENT)

        if not visible(article, request.user, "article", book_context=bool(book)):
            return Response(status=status.HTTP_204_NO_CONTENT)

        record_content_view(request, article, "article")
        if book:
            record_content_view(request, book, "book")
        return Response(status=status.HTTP_204_NO_CONTENT)


class ManagedArticleListView(APIView):
    permission_classes = (IsSiteManager,)
    ordering_fields = {
        "id": "id",
        "title": "title",
        "author": "author__username",
        "visibility": "visibility",
        "published_at": "published_at",
        "updated_at": "updated_at",
        "created_at": "created_at",
        "view_count": "view_count",
    }

    def get(self, request):
        try:
            page = max(1, int(request.query_params.get("page", 1)))
            page_size = min(100, max(1, int(request.query_params.get("page_size", 20))))
        except ValueError:
            return Response({"detail": "page and page_size must be integers."}, status=status.HTTP_400_BAD_REQUEST)

        kinds = list(dict.fromkeys(kind.strip() for kind in request.query_params.getlist("kinds") if kind.strip())) or ["published"]
        supported_kinds = {"published", "draft", "revision"}
        invalid_kinds = set(kinds) - supported_kinds
        if invalid_kinds:
            return Response({"detail": f"Unsupported kinds: {', '.join(sorted(invalid_kinds))}."}, status=status.HTTP_400_BAD_REQUEST)
        if "published" in kinds and len(kinds) > 1:
            return Response({"detail": "published cannot be combined with draft or revision."}, status=status.HTTP_400_BAD_REQUEST)

        model = Article if kinds == ["published"] else ArticleDraft
        serializer_class = ManagedArticleDraftSerializer if model is ArticleDraft else ManagedArticleSerializer
        articles = model.objects.select_related("author").prefetch_related("tags")
        query = (request.query_params.get("query") or "").strip()
        if query:
            articles = articles.filter(
                Q(title__icontains=query)
                | Q(slug__icontains=query)
                | Q(author__username__icontains=query)
                | Q(author__first_name__icontains=query)
                | Q(author__email__icontains=query)
            )

        if model is ArticleDraft:
            article_ids = Article.objects.values("pk")
            if kinds == ["revision"]:
                articles = articles.filter(article_id__in=article_ids)
            elif kinds == ["draft"]:
                articles = articles.exclude(article_id__in=article_ids)
        visibility = (request.query_params.get("visibility") or "").strip()
        if visibility in {"public", "private", "conditional"}:
            articles = articles.filter(visibility=visibility)
        author_id = (request.query_params.get("author_id") or "").strip()
        if author_id.isdigit():
            articles = articles.filter(author_id=int(author_id))
        tag = (request.query_params.get("tag") or "").strip()
        if tag:
            articles = articles.filter(tags__name__iexact=tag)

        ordering = request.query_params.get("ordering", "-updated_at")
        ordering_key = ordering.lstrip("-")
        ordering_field = self.ordering_fields.get(ordering_key)
        if ordering_field is None:
            ordering_field = "updated_at"
            ordering = "-updated_at"
        if ordering.startswith("-"):
            ordering_field = f"-{ordering_field}"
        result = Paginator(articles.order_by(ordering_field, "-id"), page_size).get_page(page)
        return Response({
            "items": serializer_class(result.object_list, many=True, context={"request": request}).data,
            "total": result.paginator.count,
        })


class MyArticleListView(APIView):
    ordering_fields = ManagedArticleListView.ordering_fields

    def get(self, request):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        try:
            page = max(1, int(request.query_params.get("page", 1)))
            page_size = min(100, max(1, int(request.query_params.get("page_size", 20))))
        except ValueError:
            raise ValidationError({"detail": "page and page_size must be integers."})

        kinds = list(dict.fromkeys(kind.strip() for kind in request.query_params.getlist("kinds") if kind.strip())) or ["published"]
        if set(kinds) - {"published", "draft", "revision"}:
            raise ValidationError({"detail": "Unsupported article kind."})
        if "published" in kinds and len(kinds) > 1:
            raise ValidationError({"detail": "published cannot be combined with draft or revision."})

        model = Article if kinds == ["published"] else ArticleDraft
        serializer_class = ManagedArticleSerializer if model is Article else ManagedArticleDraftSerializer
        articles = model.objects.filter(author=request.user).select_related("author").prefetch_related("tags")
        query = (request.query_params.get("query") or "").strip()
        if query:
            articles = articles.filter(
                Q(title__icontains=query) | Q(slug__icontains=query),
            )
        if model is ArticleDraft:
            article_ids = Article.objects.values("pk")
            if kinds == ["revision"]:
                articles = articles.filter(article_id__in=article_ids)
            elif kinds == ["draft"]:
                articles = articles.exclude(article_id__in=article_ids)
        ordering = request.query_params.get("ordering", "-updated_at")
        ordering_field = self.ordering_fields.get(ordering.lstrip("-"), "updated_at")
        if ordering.startswith("-"):
            ordering_field = f"-{ordering_field}"
        result = Paginator(articles.order_by(ordering_field, "-id"), page_size).get_page(page)
        return Response({"items": serializer_class(result.object_list, many=True, context={"request": request}).data, "total": result.paginator.count})


class ManagedBookListView(APIView):
    permission_classes = (IsSiteManager,)
    parser_classes = (JSONParser, FormParser, MultiPartParser)
    ordering_fields = {
        "name": "name",
        "article_count": "article_count",
        "visibility": "visibility",
        "author": "created_by__username",
        "updated_at": "updated_at",
    }

    def get(self, request):
        try:
            page = max(1, int(request.query_params.get("page", 1)))
            page_size = min(100, max(1, int(request.query_params.get("page_size", 20))))
        except ValueError:
            raise ValidationError({"detail": "page and page_size must be integers."})

        books = Book.objects.select_related("created_by")
        query = (request.query_params.get("query") or "").strip()
        if query:
            books = books.filter(
                Q(name__icontains=query)
                | Q(slug__icontains=query)
                | Q(created_by__username__icontains=query)
                | Q(created_by__first_name__icontains=query)
                | Q(created_by__email__icontains=query)
            )

        ordering = (request.query_params.get("ordering") or "-updated_at").strip()
        ordering_field = self.ordering_fields.get(ordering.removeprefix("-"), "updated_at")
        if ordering_field == "article_count":
            from django.db.models import Count
            books = books.annotate(article_count=Count("articles", distinct=True))
        direction = "-" if ordering.startswith("-") else ""
        result = Paginator(books.order_by(f"{direction}{ordering_field}", "-pk"), page_size).get_page(page)
        return Response({"items": ManagedBookSerializer(result.object_list, many=True).data, "total": result.paginator.count})

    def post(self, request):
        serializer = BookSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        book = serializer.save()
        AuditLogService.record(action="book.created", summary=f"Book {book.name} created", actor=request.user, metadata={"book_id": book.pk}, request=request)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ManagedBookDetailView(APIView):
    permission_classes = (IsSiteManager,)
    parser_classes = (JSONParser, FormParser, MultiPartParser)

    def get_object(self, slug):
        try:
            return Book.objects.get(slug=slug)
        except Book.DoesNotExist as exc:
            raise Http404 from exc

    def get(self, request, slug):
        return Response(BookSerializer(self.get_object(slug), context={"request": request}).data)

    def patch(self, request, slug):
        book = self.get_object(slug)
        serializer = BookSerializer(book, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        book = serializer.save()
        AuditLogService.record(action="book.updated", summary=f"Book {book.name} updated", actor=request.user, metadata={"book_id": book.pk}, request=request)
        return Response(BookSerializer(book, context={"request": request}).data)

    def delete(self, request, slug):
        book = self.get_object(slug)
        book_id, name = book.pk, book.name
        delete_book(book)
        AuditLogService.record(
            action="book.deleted",
            summary=f"Book {name} deleted",
            actor=request.user,
            metadata={"book_id": book_id},
            request=request,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class ManagedArticleTagCleanupView(APIView):
    permission_classes = (IsSiteManager,)

    def post(self, request):
        tags = Tag.objects.filter(articles__isnull=True, article_drafts__isnull=True)
        deleted_count, _ = tags.delete()
        AuditLogService.record(
            action="article_tags.cleaned",
            summary="Unused article tags cleaned",
            actor=request.user,
            metadata={"deleted_count": deleted_count},
            request=request,
        )
        return Response({"deleted_count": deleted_count})


def external_link_payload(article):
    active = is_external_link_active(article)
    return {
        "id": article.pk,
        "title": article.title,
        "slug": article.slug,
        "author": {"id": article.author_id, "username": article.author.username, "displayName": article.author.get_full_name() or article.author.username},
        "token": article.external_link_token if active else None,
        "url": f"/external-link/articles/{article.external_link_token}" if active else None,
        "expiresAt": article.external_link_expires_at,
        "passwordProtected": bool(article.external_link_password),
        "externalLinkPassword": article.external_link_password,
        "status": "active" if active else "expired" if article.external_link_token else "inactive",
        "updatedAt": article.updated_at,
    }


def book_external_link_payload(book):
    active = is_book_external_link_active(book)
    return {
        "id": book.pk,
        "title": book.name,
        "slug": book.slug,
        "author": {"id": book.created_by_id, "username": book.created_by.username, "displayName": book.created_by.get_full_name() or book.created_by.username},
        "token": book.external_link_token if active else None,
        "url": f"/external-link/books/{book.external_link_token}" if active else None,
        "expiresAt": book.external_link_expires_at,
        "passwordProtected": bool(book.external_link_password),
        "externalLinkPassword": book.external_link_password,
        "status": "active" if active else "expired" if book.external_link_token else "inactive",
        "updatedAt": book.updated_at,
    }


class ManagedArticleExternalLinkListView(APIView):
    permission_classes = (IsSiteManager,)

    def get(self, request):
        try:
            page = max(1, int(request.query_params.get("page", 1)))
            page_size = min(100, max(1, int(request.query_params.get("page_size", 20))))
        except ValueError:
            raise ValidationError({"detail": "page and page_size must be integers."})
        articles = Article.objects.select_related("author").exclude(external_link_token__isnull=True)
        query = (request.query_params.get("query") or "").strip()
        if query:
            articles = articles.filter(Q(title__icontains=query) | Q(slug__icontains=query) | Q(author__username__icontains=query) | Q(author__first_name__icontains=query))
        ordering_map = {"title": "title", "author": "author__username", "expires_at": "external_link_expires_at", "updated_at": "updated_at"}
        ordering = (request.query_params.get("ordering") or "-updated_at").strip()
        ordering_field = ordering_map.get(ordering.removeprefix("-"), "updated_at")
        articles = articles.order_by(f"{'-' if ordering.startswith('-') else ''}{ordering_field}", "-pk")
        total = articles.count()
        items = list(articles[(page - 1) * page_size:page * page_size])
        return Response({"items": [external_link_payload(article) for article in items], "total": total, "page": page, "page_size": page_size})


class ManagedArticleExternalLinkDetailView(APIView):
    permission_classes = (IsSiteManager,)

    def get_article(self, pk):
        try:
            return Article.objects.select_related("author").get(pk=pk)
        except Article.DoesNotExist as exc:
            raise Http404 from exc

    def get(self, request, pk):
        return Response(external_link_payload(self.get_article(pk)))

    def post(self, request, pk):
        article = self.get_article(pk)
        rotate_external_link(article, request.data.get("expiry", "7d"))
        article.external_link_password = request.data.get("external_link_password") or None
        article.save(update_fields=("external_link_token", "external_link_expires_at", "external_link_password", "updated_at"))
        return Response(external_link_payload(article))

    def patch(self, request, pk):
        article = self.get_article(pk)
        if not article.external_link_token:
            raise ValidationError({"detail": "The article has no external link."})
        if not is_external_link_eligible(article):
            clear_external_link(article)
            article.save(update_fields=("external_link_token", "external_link_expires_at", "external_link_password", "updated_at"))
            raise ValidationError({"detail": "Only published, unrestricted public articles can have external links."})
        set_external_link_expiry(article, request.data.get("expiry"))
        if "external_link_password" in request.data:
            article.external_link_password = request.data.get("external_link_password") or None
        article.save(update_fields=("external_link_expires_at", "external_link_password", "updated_at"))
        return Response(external_link_payload(article))

    def delete(self, request, pk):
        article = self.get_article(pk)
        clear_external_link(article)
        article.save(update_fields=("external_link_token", "external_link_expires_at", "external_link_password", "updated_at"))
        return Response(status=status.HTTP_204_NO_CONTENT)


class ManagedBookExternalLinkListView(APIView):
    permission_classes = (IsSiteManager,)

    def get(self, request):
        try:
            page = max(1, int(request.query_params.get("page", 1)))
            page_size = min(100, max(1, int(request.query_params.get("page_size", 20))))
        except ValueError:
            raise ValidationError({"detail": "page and page_size must be integers."})
        books = Book.objects.select_related("created_by").exclude(external_link_token__isnull=True)
        query = (request.query_params.get("query") or "").strip()
        if query:
            books = books.filter(Q(name__icontains=query) | Q(slug__icontains=query) | Q(created_by__username__icontains=query) | Q(created_by__first_name__icontains=query))
        ordering_map = {"title": "name", "author": "created_by__username", "expires_at": "external_link_expires_at", "updated_at": "updated_at"}
        ordering = (request.query_params.get("ordering") or "-updated_at").strip()
        ordering_field = ordering_map.get(ordering.removeprefix("-"), "updated_at")
        books = books.order_by(f"{'-' if ordering.startswith('-') else ''}{ordering_field}", "-pk")
        total = books.count()
        items = list(books[(page - 1) * page_size:page * page_size])
        return Response({"items": [book_external_link_payload(book) for book in items], "total": total, "page": page, "page_size": page_size})


class ManagedBookExternalLinkDetailView(APIView):
    permission_classes = (IsSiteManager,)

    def get_book(self, pk):
        try:
            return Book.objects.select_related("created_by").get(pk=pk)
        except Book.DoesNotExist as exc:
            raise Http404 from exc

    def get(self, request, pk):
        return Response(book_external_link_payload(self.get_book(pk)))

    def post(self, request, pk):
        book = self.get_book(pk)
        rotate_book_external_link(book, request.data.get("expiry", "7d"))
        book.external_link_password = request.data.get("external_link_password") or None
        book.save(update_fields=("external_link_token", "external_link_expires_at", "external_link_password", "updated_at"))
        return Response(book_external_link_payload(book))

    def patch(self, request, pk):
        book = self.get_book(pk)
        if not book.external_link_token:
            raise ValidationError({"detail": "The book has no external link."})
        if not is_book_external_link_eligible(book):
            clear_external_link(book)
            book.save(update_fields=("external_link_token", "external_link_expires_at", "external_link_password", "updated_at"))
            raise ValidationError({"detail": "Only public books can have external links."})
        set_external_link_expiry(book, request.data.get("expiry"))
        if "external_link_password" in request.data:
            book.external_link_password = request.data.get("external_link_password") or None
        book.save(update_fields=("external_link_expires_at", "external_link_password", "updated_at"))
        return Response(book_external_link_payload(book))

    def delete(self, request, pk):
        book = self.get_book(pk)
        clear_external_link(book)
        book.save(update_fields=("external_link_token", "external_link_expires_at", "external_link_password", "updated_at"))
        return Response(status=status.HTTP_204_NO_CONTENT)


class MyArticleExternalLinkListView(APIView):
    def get(self, request):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        try:
            page = max(1, int(request.query_params.get("page", 1)))
            page_size = min(100, max(1, int(request.query_params.get("page_size", 20))))
        except ValueError:
            raise ValidationError({"detail": "page and page_size must be integers."})
        articles = Article.objects.select_related("author").filter(author=request.user).exclude(external_link_token__isnull=True)
        query = (request.query_params.get("query") or "").strip()
        if query:
            articles = articles.filter(Q(title__icontains=query) | Q(slug__icontains=query))
        ordering_map = {"title": "title", "expires_at": "external_link_expires_at", "updated_at": "updated_at"}
        ordering = (request.query_params.get("ordering") or "-updated_at").strip()
        ordering_field = ordering_map.get(ordering.removeprefix("-"), "updated_at")
        articles = articles.order_by(f"{'-' if ordering.startswith('-') else ''}{ordering_field}", "-pk")
        result = Paginator(articles, page_size).get_page(page)
        return Response({"items": [external_link_payload(article) for article in result.object_list], "total": result.paginator.count})


class MyArticleExternalLinkDetailView(APIView):
    def get_article(self, request, pk):
        try:
            return Article.objects.select_related("author").get(pk=pk, author=request.user)
        except Article.DoesNotExist as exc:
            raise Http404 from exc

    def get(self, request, pk):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        return Response(external_link_payload(self.get_article(request, pk)))

    def post(self, request, pk):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        article = self.get_article(request, pk)
        rotate_external_link(article, request.data.get("expiry", "7d"))
        article.external_link_password = request.data.get("external_link_password") or None
        article.save(update_fields=("external_link_token", "external_link_expires_at", "external_link_password", "updated_at"))
        return Response(external_link_payload(article))

    def patch(self, request, pk):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        article = self.get_article(request, pk)
        if not article.external_link_token:
            raise ValidationError({"detail": "The article has no external link."})
        if not is_external_link_eligible(article):
            clear_external_link(article)
            article.save(update_fields=("external_link_token", "external_link_expires_at", "external_link_password", "updated_at"))
            raise ValidationError({"detail": "Only published, unrestricted public articles can have external links."})
        set_external_link_expiry(article, request.data.get("expiry"))
        if "external_link_password" in request.data:
            article.external_link_password = request.data.get("external_link_password") or None
        article.save(update_fields=("external_link_expires_at", "external_link_password", "updated_at"))
        return Response(external_link_payload(article))

    def delete(self, request, pk):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        article = self.get_article(request, pk)
        clear_external_link(article)
        article.save(update_fields=("external_link_token", "external_link_expires_at", "external_link_password", "updated_at"))
        return Response(status=status.HTTP_204_NO_CONTENT)


def ensure_external_link_password(request, resource):
    if not resource.external_link_password:
        return
    if request.headers.get("X-External-Link-Password") != resource.external_link_password:
        raise PermissionDenied({"code": "external_link_password_required", "resourceId": resource.pk})


class ExternalArticleDetailView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request, token):
        try:
            article = Article.objects.select_related("author").prefetch_related("tags").get(external_link_token=token)
        except Article.DoesNotExist as exc:
            raise Http404 from exc
        if not is_external_link_active(article):
            raise Http404
        ensure_external_link_password(request, article)
        record_content_view(request, article, "article")
        attach_interactions([article], request.user, "article")
        return Response(ArticleSerializer(article, context={"request": request}).data)


def external_article_for_token(request, token):
    try:
        article = Article.objects.select_related("author").prefetch_related("tags").get(external_link_token=token)
    except Article.DoesNotExist as exc:
        raise Http404 from exc
    if not is_external_link_active(article):
        raise Http404
    ensure_external_link_password(request, article)
    return article


class ExternalArticleCommentsView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request, token):
        article = external_article_for_token(request, token)
        from apps.comments.serializers import ArticleCommentSerializer
        from apps.comments.services import annotated_threads, apply_viewer_votes, serialize_participants

        try:
            page_size = min(50, max(1, int(request.query_params.get("page_size", 20))))
            offset = max(0, int(request.query_params.get("offset", 0)))
        except ValueError:
            page_size, offset = 20, 0
        threads = list(annotated_threads(article, request.user))
        items = apply_viewer_votes(threads[offset:offset + page_size], request.user)
        return Response({"items": ArticleCommentSerializer(items, many=True, context={"request": request}).data, "participants": serialize_participants(items, request), "hasMore": offset + page_size < len(threads), "nextOffset": offset + page_size if offset + page_size < len(threads) else None, "totalRootCount": len(threads)})


def external_asset_manifest(request, article, asset_ids, attachment_ids):
    if not isinstance(asset_ids, list) or len(asset_ids) > 100:
        raise ValidationError("assetIds must contain at most 100 asset IDs.")
    if not isinstance(attachment_ids, list) or len(attachment_ids) > 100:
        raise ValidationError("attachmentIds must contain at most 100 attachment IDs.")
    assets = MediaAsset.objects.filter(pk__in=asset_ids, status=MediaAsset.STATUS_READY, references__resource_type="article", references__resource_id=article.pk).distinct()
    attachments = Attachment.objects.filter(pk__in=attachment_ids, asset__in=assets).select_related("asset")
    attachments_by_asset = {}
    for attachment in attachments:
        attachments_by_asset.setdefault(attachment.asset_id, []).append(attachment)
    result = {}
    for asset in assets:
        selected = attachments_by_asset.get(asset.pk) or list(asset.attachments.all()[:1])
        if asset.kind != MediaAsset.KIND_ATTACHMENT or not selected:
            payload = signing.dumps({"asset_id": str(asset.pk), "disposition": "inline"}, salt="resources.media-delivery")
            result[str(asset.pk)] = {"kind": asset.kind, "state": "available", "filename": asset.original_filename, "mediaType": asset.media_type, "size": asset.file_size, "inlineUrl": request.build_absolute_uri(f"/api/resources/media-delivery/{payload}/")}
            continue
        for attachment in selected:
            if attachment.visibility != Attachment.VISIBILITY_PUBLIC:
                continue
            result[str(attachment.pk)] = {"kind": asset.kind, "state": "available", "filename": asset.original_filename, "mediaType": asset.media_type, "size": asset.file_size, "attachmentId": attachment.pk, "title": attachment.title, "extension": attachment.file_ext, "sizeLabel": f"{attachment.file_size / 1024:.1f} KB", "downloadCount": attachment.download_count, "visibility": attachment.visibility, "conditionRules": [], "accessScope": attachment.ACCESS_SCOPE_UNIFIED, "vipAccessPermission": attachment.VISIBILITY_PUBLIC, "vipConditionRules": [], "accessDecision": {"all_granted": True, "conditions": []}, "downloadState": "granted"}
    return result


class ExternalArticleAssetManifestView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request, token):
        article = external_article_for_token(request, token)
        return Response({"assets": external_asset_manifest(request, article, request.data.get("assetIds", []), request.data.get("attachmentIds", []))})


class ExternalArticleAttachmentDownloadView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request, token, asset_id):
        article = external_article_for_token(request, token)
        try:
            asset = MediaAsset.objects.get(pk=asset_id, kind=MediaAsset.KIND_ATTACHMENT, status=MediaAsset.STATUS_READY)
        except MediaAsset.DoesNotExist as exc:
            raise Http404 from exc
        attachment = asset.attachments.filter(pk=request.data.get("attachmentId")).first()
        if not attachment or attachment.visibility != Attachment.VISIBILITY_PUBLIC or not asset.references.filter(resource_type="article", resource_id=article.pk).exists():
            raise Http404
        media_token = signing.dumps({"asset_id": str(asset.pk), "attachment_id": attachment.pk, "disposition": "attachment"}, salt="resources.media-delivery")
        return Response({"url": request.build_absolute_uri(f"/api/resources/media-delivery/{media_token}/"), "expiresAt": 300})


def external_book_for_token(request, token):
    try:
        book = Book.objects.select_related("created_by").get(external_link_token=token)
    except Book.DoesNotExist as exc:
        raise Http404 from exc
    if not is_book_external_link_active(book):
        raise Http404
    ensure_external_link_password(request, book)
    return book


def external_book_articles(book):
    article_ids = list_article_ids(book.structure)
    return list(Article.objects.select_related("author").prefetch_related("tags").filter(pk__in=article_ids, visibility=Article.VISIBILITY_PUBLIC))


def filter_external_book_structure(nodes, visible_ids):
    result = []
    for node in nodes:
        if node.get("type") == "article":
            if node.get("article_id") in visible_ids:
                result.append(node)
        elif node.get("type") == "group":
            children = filter_external_book_structure(node.get("children", []), visible_ids)
            if children:
                result.append({**node, "children": children})
    return result


class ExternalBookDetailView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request, token):
        book = external_book_for_token(request, token)
        articles = external_book_articles(book)
        visible_ids = {article.pk for article in articles}
        payload = BookSerializer(book, context={"request": request}).data
        payload["structure"] = filter_external_book_structure(book.structure, visible_ids)
        payload["articles"] = ArticleSerializer(articles, many=True, context={"request": request}).data
        record_content_view(request, book, "book")
        return Response(payload)


class ExternalBookArticleDetailView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request, token, slug):
        article = external_book_article_for_token(request, token, slug)
        record_content_view(request, article, "article")
        return Response(ArticleSerializer(article, context={"request": request}).data)


def external_book_article_for_token(request, token, slug):
    book = external_book_for_token(request, token)
    try:
        article = Article.objects.select_related("author").prefetch_related("tags").get(slug=slug, visibility=Article.VISIBILITY_PUBLIC)
    except Article.DoesNotExist as exc:
        raise Http404 from exc
    if article.pk not in list_article_ids(book.structure):
        raise Http404
    return article


class ExternalBookArticleAssetManifestView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request, token, slug):
        article = external_book_article_for_token(request, token, slug)
        return Response({"assets": external_asset_manifest(request, article, request.data.get("assetIds", []), request.data.get("attachmentIds", []))})


class ExternalBookArticleAttachmentDownloadView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request, token, slug, asset_id):
        article = external_book_article_for_token(request, token, slug)
        try:
            asset = MediaAsset.objects.get(pk=asset_id, kind=MediaAsset.KIND_ATTACHMENT, status=MediaAsset.STATUS_READY)
        except MediaAsset.DoesNotExist as exc:
            raise Http404 from exc
        attachment = asset.attachments.filter(pk=request.data.get("attachmentId")).first()
        if not attachment or attachment.visibility != Attachment.VISIBILITY_PUBLIC or not asset.references.filter(resource_type="article", resource_id=article.pk).exists():
            raise Http404
        media_token = signing.dumps({"asset_id": str(asset.pk), "attachment_id": attachment.pk, "disposition": "attachment"}, salt="resources.media-delivery")
        return Response({"url": request.build_absolute_uri(f"/api/resources/media-delivery/{media_token}/"), "expiresAt": 300})


class BookListView(APIView):
    permission_classes = (AllowAny,)
    parser_classes = (JSONParser, FormParser, MultiPartParser)
    def get(self, request):
        query = (request.query_params.get("query") or "").strip()
        page, page_size, sort = list_options(request)
        books = Book.objects.all()
        search_ids = None
        if query:
            try:
                search_ids = cached_search_ids("books", query, search_book_ids)
            except ZincSearchError as exc:
                raise ValidationError({"detail": str(exc)}) from exc
            cursor = search_cursor(request)

            def load_batch(candidate_ids):
                return attach_interactions(Book.objects.filter(pk__in=candidate_ids).select_related("created_by"), request.user, "book")

            return cursor_search_response(
                search_ids,
                cursor,
                page_size,
                load_batch,
                lambda book: request.user.is_staff or request.user.is_superuser or not cannot_open_from_listing(book, request.user, "book"),
                lambda values, many: BookSerializer(values, many=many, context={"request": request}),
            )
        return database_list_response(books, request, "book", lambda values, many: BookSerializer(values, many=many, context={"request": request}))

    def post(self, request):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        require_book_write_permission(request.user)
        serializer = BookSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class BookDetailView(APIView):
    permission_classes = (AllowAny,)
    parser_classes = (JSONParser, FormParser, MultiPartParser)
    def get_object(self, slug):
        try:
            return Book.objects.get(slug=slug)
        except Book.DoesNotExist as exc:
            raise Http404 from exc

    def get(self, request, slug):
        book = self.get_object(slug)
        if not visible(book, request.user, "book"):
            raise PermissionDenied("Book access is required.")
        record_content_view(request, book, "book")
        return Response(BookSerializer(book, context={"request": request}).data)

    def patch(self, request, slug):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        book = self.get_object(slug)
        if not can_manage(request.user, book):
            raise PermissionDenied()
        require_book_write_permission(request.user)
        serializer = BookSerializer(book, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return Response(BookSerializer(serializer.save(), context={"request": request}).data)

    def delete(self, request, slug):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        book = self.get_object(slug)
        if not can_manage(request.user, book):
            raise PermissionDenied()
        delete_book(book)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MyBookListView(APIView):
    ordering_fields = ManagedBookListView.ordering_fields

    def get(self, request):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        try:
            page = max(1, int(request.query_params.get("page", 1)))
            page_size = min(100, max(1, int(request.query_params.get("page_size", 20))))
        except ValueError:
            raise ValidationError({"detail": "page and page_size must be integers."})
        books = Book.objects.filter(created_by=request.user).select_related("created_by")
        query = (request.query_params.get("query") or "").strip()
        if query:
            books = books.filter(Q(name__icontains=query) | Q(slug__icontains=query))
        ordering = (request.query_params.get("ordering") or "-updated_at").strip()
        ordering_field = self.ordering_fields.get(ordering.removeprefix("-"), "updated_at")
        if ordering_field == "article_count":
            from django.db.models import Count
            books = books.annotate(article_count=Count("articles", distinct=True))
        result = Paginator(books.order_by(f"{'-' if ordering.startswith('-') else ''}{ordering_field}", "-pk"), page_size).get_page(page)
        return Response({"items": ManagedBookSerializer(result.object_list, many=True).data, "total": result.paginator.count})


class MyBookExternalLinkListView(APIView):
    def get(self, request):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        try:
            page = max(1, int(request.query_params.get("page", 1)))
            page_size = min(100, max(1, int(request.query_params.get("page_size", 20))))
        except ValueError:
            raise ValidationError({"detail": "page and page_size must be integers."})
        books = Book.objects.select_related("created_by").filter(created_by=request.user).exclude(external_link_token__isnull=True)
        query = (request.query_params.get("query") or "").strip()
        if query:
            books = books.filter(Q(name__icontains=query) | Q(slug__icontains=query))
        ordering_map = {"title": "name", "expires_at": "external_link_expires_at", "updated_at": "updated_at"}
        ordering = (request.query_params.get("ordering") or "-updated_at").strip()
        ordering_field = ordering_map.get(ordering.removeprefix("-"), "updated_at")
        result = Paginator(books.order_by(f"{'-' if ordering.startswith('-') else ''}{ordering_field}", "-pk"), page_size).get_page(page)
        return Response({"items": [book_external_link_payload(book) for book in result.object_list], "total": result.paginator.count})


class MyBookExternalLinkDetailView(APIView):
    def get_book(self, request, pk):
        try:
            return Book.objects.select_related("created_by").get(pk=pk, created_by=request.user)
        except Book.DoesNotExist as exc:
            raise Http404 from exc

    def get(self, request, pk):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        return Response(book_external_link_payload(self.get_book(request, pk)))

    def post(self, request, pk):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        book = self.get_book(request, pk)
        require_book_write_permission(request.user)
        if not is_book_external_link_eligible(book):
            raise ValidationError({"detail": "Only public books can have external links."})
        rotate_book_external_link(book, request.data.get("expiry", "7d"))
        book.external_link_password = request.data.get("external_link_password") or None
        book.save(update_fields=("external_link_token", "external_link_expires_at", "external_link_password", "updated_at"))
        return Response(book_external_link_payload(book))

    def patch(self, request, pk):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        book = self.get_book(request, pk)
        require_book_write_permission(request.user)
        if not book.external_link_token:
            raise ValidationError({"detail": "The book has no external link."})
        if not is_book_external_link_eligible(book):
            clear_external_link(book)
            book.save(update_fields=("external_link_token", "external_link_expires_at", "external_link_password", "updated_at"))
            raise ValidationError({"detail": "Only public books can have external links."})
        set_external_link_expiry(book, request.data.get("expiry"))
        if "external_link_password" in request.data:
            book.external_link_password = request.data.get("external_link_password") or None
        book.save(update_fields=("external_link_expires_at", "external_link_password", "updated_at"))
        return Response(book_external_link_payload(book))

    def delete(self, request, pk):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        book = self.get_book(request, pk)
        require_book_write_permission(request.user)
        clear_external_link(book)
        book.save(update_fields=("external_link_token", "external_link_expires_at", "external_link_password", "updated_at"))
        return Response(status=status.HTTP_204_NO_CONTENT)


class ResourcePreviewView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request, resource_type, slug):
        model, serializer = (Article, ArticleSerializer) if resource_type == "articles" else (ArticleDraft, ArticleDraftSerializer) if resource_type == "drafts" else (Book, BookSerializer) if resource_type == "books" else (None, None)
        if model is None:
            raise Http404
        try:
            resource = model.objects.select_related("author").prefetch_related("tags").get(slug=slug) if model in {Article, ArticleDraft} else model.objects.get(slug=slug)
        except model.DoesNotExist as exc:
            raise Http404 from exc
        if model is ArticleDraft and not can_manage(request.user, resource):
            raise Http404
        if model is not ArticleDraft and not can_discover(resource, request.user):
            raise Http404
        if model is not ArticleDraft:
            attach_interactions([resource], request.user, "article" if model is Article else "book")
        return Response(serializer(resource, context={"request": request}).data)


class ArticleDraftListView(APIView):
    parser_classes = (JSONParser, FormParser, MultiPartParser)
    def get(self, request):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        drafts = ArticleDraft.objects.select_related("author").prefetch_related("tags")
        if not request.user.is_staff and not request.user.is_superuser:
            drafts = drafts.filter(author=request.user)
        return Response(ArticleDraftSerializer(drafts, many=True, context={"request": request}).data)

    def post(self, request):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        require_article_write_permission(request.user, creating=True)
        serializer = ArticleDraftSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return Response(ArticleDraftSerializer(serializer.save(), context={"request": request}).data, status=status.HTTP_201_CREATED)


class ArticleDraftDetailView(APIView):
    permission_classes = (AllowAny,)
    parser_classes = (JSONParser, FormParser, MultiPartParser)

    def get_object(self, slug):
        try:
            return ArticleDraft.objects.select_related("author").prefetch_related("tags").get(slug=slug)
        except ArticleDraft.DoesNotExist as exc:
            raise Http404 from exc

    def get(self, request, slug):
        draft = self.get_object(slug)
        if not can_manage(request.user, draft):
            raise Http404
        return Response(ArticleDraftSerializer(draft, context={"request": request}).data)

    def patch(self, request, slug):
        draft = self.get_object(slug)
        if not request.user.is_authenticated or not can_manage(request.user, draft):
            raise PermissionDenied()
        require_article_write_permission(request.user)
        serializer = ArticleDraftSerializer(draft, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return Response(ArticleDraftSerializer(serializer.save(), context={"request": request}).data)

    def delete(self, request, slug):
        draft = self.get_object(slug)
        if not request.user.is_authenticated or not can_manage(request.user, draft):
            raise PermissionDenied()
        delete_article_draft(draft)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ArticleRevisionView(APIView):
    def post(self, request, slug):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        try:
            article = Article.objects.select_related("author").prefetch_related("tags").get(slug=slug)
        except Article.DoesNotExist as exc:
            raise Http404 from exc
        if not can_manage(request.user, article):
            raise PermissionDenied()
        require_article_write_permission(request.user)
        try:
            content_document = get_article_document(article.pk)
        except ZincSearchError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        with transaction.atomic():
            existing = ArticleDraft.objects.filter(article_id=article.pk).first()
            replaced_cover_name = existing.cover_image.name if existing else ""
            draft, _ = ArticleDraft.objects.update_or_create(
                article_id=article.pk,
                defaults={
                    "title": article.title, "slug": article.slug, "abstract": content_document.get("abstract", ""),
                    "content": content_document.get("content", ""), "suppress_detail_hero": article.suppress_detail_hero,
                    "allow_quote": article.allow_quote, "allow_reprint": article.allow_reprint,
                    "cover_image": article.cover_image.name, "author": article.author,
                    "visibility": article.visibility, "condition_rules": article.condition_rules, "access_scope": article.access_scope,
                    "vip_access_permission": article.vip_access_permission, "vip_condition_rules": article.vip_condition_rules,
                },
            )
            draft.tags.set(article.tags.all())
            schedule_unreferenced_cover_cleanup([replaced_cover_name])
        return Response(ArticleDraftSerializer(draft, context={"request": request}).data, status=status.HTTP_201_CREATED)


class ArticleDraftPublishView(APIView):
    def post(self, request, slug):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        try:
            draft = ArticleDraft.objects.select_related("author").prefetch_related("tags").get(slug=slug)
        except ArticleDraft.DoesNotExist as exc:
            raise Http404 from exc
        if not can_manage(request.user, draft):
            raise PermissionDenied()
        require_article_write_permission(request.user)
        fields = ("title", "slug", "suppress_detail_hero", "allow_quote", "allow_reprint", "cover_image", "author", "visibility", "condition_rules", "access_scope", "vip_access_permission", "vip_condition_rules")
        with transaction.atomic():
            article = Article.objects.filter(pk=draft.article_id).first()
            old_cover_name = article.cover_image.name if article else ""
            draft_cover_name = draft.cover_image.name
            if article:
                for field in fields:
                    setattr(article, field, getattr(draft, field))
                article.cover_image.name = promote_revision_cover(article, draft_cover_name)
                article.save()
            else:
                article = Article.objects.create(pk=draft.article_id, published_at=timezone.now(), **{field: getattr(draft, field) for field in fields})
            article.tags.set(draft.tags.all())
            if not is_external_link_eligible(article):
                clear_external_link(article)
                article.save(update_fields=("external_link_token", "external_link_expires_at", "external_link_password", "updated_at"))
            draft.delete()
            abstract, content = draft.abstract, draft.content
            index_article(article, abstract, content)
            article._zinc_article_document = {"abstract": abstract, "content": content}
            schedule_unreferenced_cover_cleanup([old_cover_name, draft_cover_name])
        return Response(ArticleSerializer(article, context={"request": request}).data)


class ResourceInteractionView(APIView):
    def put(self, request, resource_type, slug, action):
        if not request.user.is_authenticated:
            raise PermissionDenied()
        model, access_type, interaction_type = (Article, "article", "article") if resource_type == "articles" else (Book, "book", "book") if resource_type == "books" else (None, None, None)
        if model is None or action not in {"star", "vote"}:
            raise Http404
        try:
            resource = model.objects.get(slug=slug)
        except model.DoesNotExist as exc:
            raise Http404 from exc
        require_access(request, resource, access_type)
        if action == "star":
            starred = request.data.get("starred")
            if not isinstance(starred, bool):
                raise ValidationError({"starred": "A boolean is required."})
            interaction = set_star(resource, request.user, interaction_type, starred)
        else:
            vote = request.data.get("vote")
            if vote not in {None, "up", "down"}:
                raise ValidationError({"vote": "Use up, down, or null."})
            interaction = set_vote(resource, request.user, interaction_type, vote)
        return Response({"id": resource.pk, "interaction": interaction})


class AttachmentListView(APIView):
    ordering_fields = {
        "title": "title",
        "updated_at": "updated_at",
        "created_at": "created_at",
        "file_size": "file_size",
        "download_count": "download_count",
        "usage_count": "usage_count",
    }

    def get_queryset(self, request):
        attachments = Attachment.objects.filter(uploaded_by=request.user).select_related("asset", "uploaded_by")
        query = (request.query_params.get("query") or "").strip()
        if query:
            attachments = attachments.filter(Q(title__icontains=query) | Q(original_filename__icontains=query))
        ordering = (request.query_params.get("ordering") or "-updated_at").strip()
        ordering_field = ordering.removeprefix("-")
        if ordering_field not in self.ordering_fields:
            ordering = "-updated_at"
        return attachments.order_by(ordering, "-pk")

    def get(self, request):
        try:
            page = max(1, int(request.query_params.get("page", 1)))
            page_size = min(50, max(1, int(request.query_params.get("page_size", 10))))
        except ValueError:
            page, page_size = 1, 10
        attachments = self.get_queryset(request)
        total = attachments.count()
        start = (page - 1) * page_size
        return Response({"items": AttachmentSerializer(attachments[start:start + page_size], many=True, context={"request": request}).data, "total": total, "page": page, "page_size": page_size})

    def post(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            settings = SiteSettingsService.get_all()["upload.attachment"]
            if not settings["allow_user_upload"]:
                raise PermissionDenied("Attachment uploads are disabled for users.")
            if settings["vip_only"] and not UserIdentityService.resolve(request.user).is_vip:
                raise PermissionDenied("Attachment uploads require VIP access.")
        serializer = AttachmentSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        if request.FILES.get("file"):
            validate_upload(request.FILES["file"], "attachment")
            ensure_user_storage_capacity(request.user, request.FILES["file"].size)
        return Response(AttachmentSerializer(serializer.save(), context={"request": request}).data, status=status.HTTP_201_CREATED)


class AttachmentDetailView(APIView):
    def get_object(self, pk):
        try:
            return Attachment.objects.select_related("asset", "uploaded_by").get(pk=pk)
        except Attachment.DoesNotExist as exc:
            raise Http404 from exc

    def patch(self, request, pk):
        attachment = self.get_object(pk)
        if not can_manage(request.user, attachment):
            raise PermissionDenied()
        serializer = AttachmentSerializer(attachment, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        attachment = serializer.save()
        AuditLogService.record(action="attachment.updated", summary=f"Attachment {attachment.title} updated", actor=request.user, metadata={"attachment_id": attachment.pk}, request=request)
        return Response(AttachmentSerializer(attachment, context={"request": request}).data)

    def delete(self, request, pk):
        attachment = self.get_object(pk)
        if not can_manage(request.user, attachment):
            raise PermissionDenied()
        attachment_id, title = attachment.pk, attachment.title
        delete_attachment(attachment)
        AuditLogService.record(action="attachment.deleted", summary=f"Attachment {title} deleted", actor=request.user, metadata={"attachment_id": attachment_id}, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AttachmentDownloadView(APIView):
    def get(self, request, pk):
        try:
            attachment = Attachment.objects.select_related("asset").get(pk=pk)
        except Attachment.DoesNotExist as exc:
            raise Http404 from exc
        require_access(request, attachment, "attachment")
        token = signing.dumps(
            {"asset_id": str(attachment.asset_id), "attachment_id": attachment.pk, "disposition": "attachment"},
            salt="resources.media-delivery",
        )
        return Response({"url": request.build_absolute_uri(f"/api/resources/media-delivery/{token}/"), "expiresAt": 300})


class ManagedAttachmentDetailView(AttachmentDetailView):
    permission_classes = (IsSiteManager,)


class ManagedAttachmentListView(APIView):
    permission_classes = (IsSiteManager,)
    ordering_fields = {
        "title": "title",
        "author": "uploaded_by__username",
        "updated_at": "updated_at",
        "created_at": "created_at",
        "file_size": "file_size",
        "download_count": "download_count",
        "usage_count": "usage_count",
    }

    def get(self, request):
        try:
            page = max(1, int(request.query_params.get("page", 1)))
            page_size = min(100, max(1, int(request.query_params.get("page_size", 20))))
        except ValueError:
            raise ValidationError({"detail": "page and page_size must be integers."})
        attachments = Attachment.objects.select_related("asset", "uploaded_by")
        query = (request.query_params.get("query") or "").strip()
        if query:
            attachments = attachments.filter(Q(title__icontains=query) | Q(original_filename__icontains=query) | Q(uploaded_by__username__icontains=query) | Q(uploaded_by__first_name__icontains=query))
        ordering = (request.query_params.get("ordering") or "-updated_at").strip()
        if ordering.removeprefix("-") not in self.ordering_fields:
            ordering = "-updated_at"
        attachments = attachments.order_by(ordering, "-pk")
        total = attachments.count()
        start = (page - 1) * page_size
        return Response({"items": AttachmentSerializer(attachments[start:start + page_size], many=True, context={"request": request}).data, "total": total, "page": page, "page_size": page_size})


class MediaDeliveryView(APIView):
    """Deliver one short-lived media capability issued from an authorized page context."""
    permission_classes = ()
    authentication_classes = ()

    def get(self, request, token):
        try:
            payload = signing.loads(token, salt="resources.media-delivery", max_age=300)
        except signing.BadSignature as exc:
            raise Http404 from exc
        cover_type = payload.get("cover_type")
        if cover_type:
            model = {"article": Article, "draft": ArticleDraft, "book": Book}.get(cover_type)
            if model is None:
                raise Http404
            try:
                resource = model.objects.get(pk=payload["cover_id"])
            except (KeyError, model.DoesNotExist) as exc:
                raise Http404 from exc
            if (
                not resource.cover_image
                or resource.cover_image.name != payload.get("cover_name")
                or resource.updated_at.isoformat() != payload.get("cover_updated_at")
            ):
                raise Http404
            return image_response(resource.cover_image)
        try:
            asset = MediaAsset.objects.get(pk=payload["asset_id"], status=MediaAsset.STATUS_READY)
        except (KeyError, MediaAsset.DoesNotExist) as exc:
            raise Http404
        attachment_id = payload.get("attachment_id")
        attachment = asset.attachments.filter(pk=attachment_id).first() if attachment_id else asset.attachments.first()
        if payload.get("disposition") == "attachment":
            if not attachment:
                raise Http404
            Attachment.objects.filter(pk=attachment.pk).update(download_count=F("download_count") + 1)
        response = FileResponse(asset.file.open("rb"), as_attachment=payload.get("disposition") == "attachment", filename=asset.original_filename)
        response["Content-Type"] = asset.media_type or "application/octet-stream"
        response["X-Content-Type-Options"] = "nosniff"
        response["Referrer-Policy"] = "no-referrer"
        return response


class PublicMediaView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request, category, identifier, field=None):
        if category == "avatars":
            try:
                user = get_user_model().objects.get(pk=identifier)
            except get_user_model().DoesNotExist as exc:
                raise Http404 from exc
            if not user.avatar:
                raise Http404
            return image_response(user.avatar)
        if category == "site-assets":
            if identifier not in {"site_icon", "auth_background", "app_background"} or field is not None:
                raise Http404
            from apps.site_settings.application.settings_service import SiteSettingsService
            from apps.site_settings.application.storage import site_asset_storage_name
            name = site_asset_storage_name(
                SiteSettingsService.get_all()["basic.assets"].get(identifier, ""),
                identifier,
            )
            if not name or not default_storage.exists(name):
                raise Http404
            return image_response(default_storage.open(name, "rb"))
        model = {"articles": Article, "books": Book}.get(category)
        if model is None or field != "cover":
            raise Http404
        try:
            resource = model.objects.get(pk=identifier, visibility="public")
        except model.DoesNotExist as exc:
            raise Http404 from exc
        if not resource.cover_image:
            raise Http404
        return image_response(resource.cover_image)


class MediaUploadView(APIView):
    def post(self, request, kind):
        if kind not in {"image", "video"}:
            raise Http404
        if kind == "video" and not (request.user.is_staff or request.user.is_superuser):
            settings = SiteSettingsService.get_all()["upload.video"]
            if not settings["allow_user_upload"]:
                raise PermissionDenied("Video uploads are disabled for users.")
            if settings["vip_only"] and not UserIdentityService.resolve(request.user).is_vip:
                raise PermissionDenied("Video uploads require VIP access.")
        file = request.FILES.get(kind) or request.FILES.get("file")
        validate_upload(file, kind)
        ensure_user_storage_capacity(request.user, file.size)
        asset = MediaAsset.objects.create(
            kind=kind,
            file=file,
            original_filename=file.name,
            media_type=getattr(file, "content_type", "") or "application/octet-stream",
            file_size=file.size,
            uploaded_by=request.user,
        )
        MediaAsset.objects.filter(pk=asset.pk).update(storage_key=asset.file.name)
        token = signing.dumps({"asset_id": str(asset.pk), "disposition": "inline"}, salt="resources.media-delivery")
        return Response({"assetId": str(asset.pk), "kind": asset.kind, "filename": asset.original_filename, "mediaType": asset.media_type, "size": asset.file_size, "status": asset.status, "previewUrl": request.build_absolute_uri(f"/api/resources/media-delivery/{token}/")}, status=status.HTTP_201_CREATED)


class ContentAssetManifestView(APIView):
    permission_classes = (AllowAny,)
    def post(self, request, resource_type, slug):
        model = Article if resource_type == "articles" else ArticleDraft if resource_type == "drafts" else Book if resource_type == "books" else None
        if model is None:
            raise Http404
        try:
            resource = model.objects.get(slug=slug)
        except model.DoesNotExist as exc:
            raise Http404 from exc
        access_type = "article" if resource_type == "articles" else "book"
        book_context = resource_type == "articles" and book_context_for_article(request, resource)
        if model is ArticleDraft and not can_manage(request.user, resource):
            raise PermissionDenied("Draft access is required.")
        if model is not ArticleDraft and not visible(resource, request.user, access_type, book_context=book_context):
            raise PermissionDenied("Content access is required.")
        asset_ids = request.data.get("assetIds", [])
        attachment_ids = request.data.get("attachmentIds", [])
        if not isinstance(asset_ids, list) or len(asset_ids) > 100:
            raise ValidationError("assetIds must contain at most 100 asset IDs.")
        if not isinstance(attachment_ids, list) or len(attachment_ids) > 100:
            raise ValidationError("attachmentIds must contain at most 100 attachment IDs.")
        # A reference must be present in the persisted content, not merely requested by ID.
        resource_id = resource.article_id if model is ArticleDraft else resource.pk
        assets = MediaAsset.objects.filter(pk__in=asset_ids, status=MediaAsset.STATUS_READY, references__resource_type="article" if model is ArticleDraft else resource_type[:-1], references__resource_id=resource_id).distinct()
        result = {}
        attachments = list(Attachment.objects.filter(
            pk__in=attachment_ids,
            asset__in=assets,
        ).select_related("asset"))
        for asset in assets:
            selected_attachments = [
                attachment
                for attachment in attachments
                if attachment.asset_id == asset.pk
            ] or [asset.attachments.first()]
            payload = {"asset_id": str(asset.pk), "resource_type": resource_type, "resource_id": resource_id, "disposition": "inline"}
            for attachment in selected_attachments:
                item = {"kind": asset.kind, "state": "available", "filename": asset.original_filename, "mediaType": asset.media_type, "size": asset.file_size}
                if attachment:
                    access_decision = ResourceCheckService.build_access_check(
                        attachment,
                        request.user,
                        resource_type="attachment",
                        book_context=resource_type == "books" or book_context,
                    ).to_dict()
                    item.update({
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
                        "accessDecision": access_decision,
                        "downloadState": "granted" if access_decision["all_granted"] else "restricted",
                    })
                else:
                    item["inlineUrl"] = request.build_absolute_uri(f"/api/resources/media-delivery/{signing.dumps(payload, salt='resources.media-delivery')}/")
                result[
                    str(attachment.pk)
                    if attachment and str(attachment.pk) in attachment_ids
                    else str(asset.pk)
                ] = item
        return Response({"assets": result})


class ContextAttachmentDownloadView(APIView):
    permission_classes = (AllowAny,)
    def post(self, request, resource_type, slug, asset_id):
        model = Article if resource_type == "articles" else ArticleDraft if resource_type == "drafts" else Book if resource_type == "books" else None
        if model is None:
            raise Http404
        try:
            resource = model.objects.get(slug=slug)
            asset = MediaAsset.objects.get(pk=asset_id, kind=MediaAsset.KIND_ATTACHMENT, status=MediaAsset.STATUS_READY)
        except (model.DoesNotExist, MediaAsset.DoesNotExist) as exc:
            raise Http404 from exc
        attachment_id = request.data.get("attachmentId")
        attachment = asset.attachments.filter(pk=attachment_id).first() if attachment_id else asset.attachments.first()
        book_context = resource_type == "articles" and book_context_for_article(request, resource)
        resource_id = resource.article_id if model is ArticleDraft else resource.pk
        has_access = can_manage(request.user, resource) if model is ArticleDraft else visible(resource, request.user, "article" if resource_type == "articles" else "book", book_context=book_context)
        if not attachment or not asset.references.filter(resource_type="article" if model is ArticleDraft else resource_type[:-1], resource_id=resource_id).exists() or not has_access or not visible(attachment, request.user, "attachment", book_context=resource_type == "books" or book_context):
            raise PermissionDenied("Attachment access is required.")
        token = signing.dumps({"asset_id": str(asset.pk), "attachment_id": attachment.pk, "resource_type": resource_type, "resource_id": resource_id, "disposition": "attachment"}, salt="resources.media-delivery")
        return Response({"url": request.build_absolute_uri(f"/api/resources/media-delivery/{token}/"), "expiresAt": 300})
