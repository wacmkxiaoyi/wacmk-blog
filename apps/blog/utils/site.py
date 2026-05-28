from datetime import timedelta

from django.db import transaction
from django.db.models import Count, F
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.blog.models import Book, ContentViewLog, Post, SiteSetting
from apps.blog.utils.request import get_client_ip


SHARE_LINK_EXPIRY_OPTIONS = {
    "1d": {"label": _("1 day"), "delta": timedelta(days=1)},
    "7d": {"label": _("7 days"), "delta": timedelta(days=7)},
    "30d": {"label": _("30 days"), "delta": timedelta(days=30)},
    "never": {"label": _("Never expires"), "delta": None},
}

VIEW_COUNT_COOLDOWN_MINUTES = 30


def get_view_count_window_start():
    return timezone.now() - timedelta(minutes=VIEW_COUNT_COOLDOWN_MINUTES)


def record_content_view(request, *, content_type, object_id, model):
    ip_address = get_client_ip(request)
    user = request.user if request.user.is_authenticated else None
    window_start = get_view_count_window_start()

    if not ip_address:
        return False

    existing_views = ContentViewLog.objects.filter(
        content_type=content_type,
        object_id=object_id,
        viewed_at__gte=window_start,
        ip_address=ip_address,
    )

    if existing_views.exists():
        return False

    with transaction.atomic():
        locked_views = ContentViewLog.objects.select_for_update().filter(
            content_type=content_type,
            object_id=object_id,
            viewed_at__gte=window_start,
            ip_address=ip_address,
        )
        if locked_views.exists():
            return False

        ContentViewLog.objects.create(
            content_type=content_type,
            object_id=object_id,
            user=user,
            ip_address=ip_address,
            session_key="",
        )
        model.objects.filter(pk=object_id).update(view_count=F("view_count") + 1)

    return True


def record_post_view(request, post):
    return record_content_view(
        request,
        content_type=ContentViewLog.CONTENT_TYPE_POST,
        object_id=post.pk,
        model=Post,
    )


def record_book_view(request, book):
    return record_content_view(
        request,
        content_type=ContentViewLog.CONTENT_TYPE_BOOK,
        object_id=book.pk,
        model=Book,
    )


def build_visit_trend(days=7):
    today = timezone.localdate()
    start_date = today - timedelta(days=days - 1)
    rows = list(
        ContentViewLog.objects.filter(viewed_at__date__gte=start_date)
        .annotate(day=TruncDate("viewed_at"))
        .values("content_type", "day")
        .annotate(total=Count("id"))
        .order_by("day", "content_type")
    )

    article_lookup = {}
    book_lookup = {}
    max_total = 0
    for row in rows:
        total = row["total"]
        max_total = max(max_total, total)
        if row["content_type"] == ContentViewLog.CONTENT_TYPE_POST:
            article_lookup[row["day"]] = total
        elif row["content_type"] == ContentViewLog.CONTENT_TYPE_BOOK:
            book_lookup[row["day"]] = total

    trend = []
    for offset in range(days):
        day = start_date + timedelta(days=offset)
        article_total = article_lookup.get(day, 0)
        book_total = book_lookup.get(day, 0)
        article_height = 0
        book_height = 0
        if max_total:
            if article_total > 0:
                article_height = max(8, round((article_total / max_total) * 100))
            if book_total > 0:
                book_height = max(8, round((book_total / max_total) * 100))
        trend.append(
            {
                "day": day,
                "label": day.strftime("%m/%d"),
                "article_total": article_total,
                "book_total": book_total,
                "article_height": article_height,
                "book_height": book_height,
            }
        )
    return trend


def get_site_setting():
    return SiteSetting.objects.order_by("pk").first()


def get_or_create_site_setting():
    site_setting = get_site_setting()
    if site_setting is None:
        site_setting = SiteSetting.objects.create()
    return site_setting


def format_share_link_expires_display(share_link):
    if not share_link:
        return ""
    if share_link.expires_at is None:
        return str(_("Never expires"))
    return timezone.localtime(share_link.expires_at).strftime("%Y-%m-%d %H:%M")


def build_share_expiry_options():
    return [{"value": key, "label": str(option["label"])} for key, option in SHARE_LINK_EXPIRY_OPTIONS.items()]
