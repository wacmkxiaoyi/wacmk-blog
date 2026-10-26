from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.resources.models import Article, Attachment, Book
from apps.site_settings.application.settings_service import SiteSettingsService
from apps.tags.models import Tag
from apps.users.models import User

from .models import ContentViewLog


def discoverable(queryset, user, owner_field):
    if user.is_staff or user.is_superuser:
        return queryset
    return queryset.filter(~Q(visibility="private") | Q(**{owner_field: user}))


class HomeDashboardView(APIView):
    def get(self, request):
        user = request.user
        articles = discoverable(Article.objects.all(), user, "author")
        books = discoverable(Book.objects.all(), user, "created_by")
        attachments = discoverable(Attachment.objects.all(), user, "uploaded_by")
        article_author_ids = articles.values_list("author_id", flat=True)
        book_author_ids = books.values_list("created_by_id", flat=True)

        site = SiteSettingsService.get_all()["basic.site"]
        trend_days = int(site.get("dashboard_visit_trend_days", 7))
        start_date = timezone.localdate() - timedelta(days=trend_days - 1)
        visible_article_ids = articles.values("pk")
        visible_book_ids = books.values("pk")
        trend_rows = ContentViewLog.objects.filter(viewed_at__date__gte=start_date).filter(
            Q(resource_type=ContentViewLog.RESOURCE_TYPE_ARTICLE, resource_id__in=visible_article_ids)
            | Q(resource_type=ContentViewLog.RESOURCE_TYPE_BOOK, resource_id__in=visible_book_ids)
        ).annotate(day=TruncDate("viewed_at")).values("day", "resource_type").annotate(count=Count("id"))
        trend_map = {(row["day"], row["resource_type"]): row["count"] for row in trend_rows}
        trend = []
        for offset in range(trend_days):
            day = start_date + timedelta(days=offset)
            trend.append({
                "date": day.isoformat(),
                "articles": trend_map.get((day, ContentViewLog.RESOURCE_TYPE_ARTICLE), 0),
                "books": trend_map.get((day, ContentViewLog.RESOURCE_TYPE_BOOK), 0),
            })

        return Response({
            "stats": {
                "articles": articles.count(),
                "tags": Tag.objects.filter(articles__in=articles).distinct().count(),
                "books": books.count(),
                "attachments": attachments.count(),
                "authors": User.objects.filter(Q(pk__in=article_author_ids) | Q(pk__in=book_author_ids)).distinct().count(),
            },
            "visits": {
                "articles": sum(item["articles"] for item in trend),
                "books": sum(item["books"] for item in trend),
                "days": trend_days,
            },
            "trend": trend,
        })
