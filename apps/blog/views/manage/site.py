from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib import messages
from django.db.models import Q
from django.shortcuts import redirect
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.views.generic import ListView, TemplateView

from apps.blog.forms.common import SearchForm
from apps.blog.forms.site import SiteSettingForm
from apps.blog.models import Attachment, AuditLog, Book, ContentViewLog, Post, PostDraft, Tag
from apps.blog.utils import (
    DASHBOARD_VISIT_TREND_DAYS_7,
    get_normalized_vip_configs,
    build_visit_trend,
    delete_setting_file,
    get_normalized_vip_level_names,
    get_or_create_site_setting,
    get_setting_file_url,
    reset_site_settings,
    write_audit_log,
)
from apps.blog.views.manage.base import ManageBaseMixin
from apps.blog.views.post.utils import get_visible_post_queryset, order_posts_by_user_stars, prepare_post_cards, with_post_feedback_counts


User = get_user_model()


class DashboardSearchForm(SearchForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["q"].widget.attrs["placeholder"] = _("Search dashboard...")


class BlogHomeView(LoginRequiredMixin, ListView):
    template_name = "blog/home.html"
    context_object_name = "posts"
    paginate_by = 9

    def get_queryset(self):
        queryset = with_post_feedback_counts(get_visible_post_queryset(self.request.user))
        queryset = order_posts_by_user_stars(queryset, self.request.user, "-published_at", "-updated_at")
        return prepare_post_cards(queryset)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        site_setting = get_or_create_site_setting()
        trend_days = site_setting.get("dashboard_visit_trend_days") or DASHBOARD_VISIT_TREND_DAYS_7
        published_posts = get_visible_post_queryset(self.request.user).filter(status=Post.STATUS_PUBLISHED)
        draft_posts = PostDraft.objects.select_related("author", "source_post")
        now = timezone.now()
        seven_days_ago = now - timedelta(days=7)
        thirty_days_ago = now - timedelta(days=30)

        context["stats"] = {
            "total_posts": published_posts.count() + draft_posts.count() if not (self.request.user.is_staff or self.request.user.is_superuser) else Post.objects.count() + PostDraft.objects.count(),
            "published_posts": published_posts.count(),
            "draft_posts": draft_posts.count(),
            "tag_count": Tag.objects.count(),
            "book_count": Book.objects.count(),
            "attachment_count": Attachment.objects.count(),
            "author_count": User.objects.filter(Q(posts__isnull=False) | Q(post_drafts__isnull=False)).distinct().count(),
            "article_views_last_7_days": ContentViewLog.objects.filter(
                content_type=ContentViewLog.CONTENT_TYPE_POST,
                viewed_at__gte=seven_days_ago,
            ).count(),
            "book_views_last_7_days": ContentViewLog.objects.filter(
                content_type=ContentViewLog.CONTENT_TYPE_BOOK,
                viewed_at__gte=seven_days_ago,
            ).count(),
            "activity_last_30_days": AuditLog.objects.filter(created_at__gte=thirty_days_ago).count(),
        }
        context["featured_post"] = context["posts"][0] if context["posts"] else None
        context["visit_trend"] = build_visit_trend(days=trend_days)
        context["visit_trend_days"] = trend_days
        context["search_form"] = DashboardSearchForm(self.request.GET or None)
        return context


class ManageSiteSettingView(ManageBaseMixin, TemplateView):
    template_name = "blog/manage/site_settings.html"

    def get_site_setting(self):
        return get_or_create_site_setting()

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        site_setting = kwargs.get("site_setting") or self.get_site_setting()
        form = kwargs.get("form") or SiteSettingForm(settings=site_setting)
        context.update(self.get_manage_context(section="basic", page_title=_("Basic settings")))
        context["form"] = form
        context["site_setting"] = site_setting
        context["vip_level_names"] = get_normalized_vip_level_names(site_setting)
        context["vip_configs"] = get_normalized_vip_configs(site_setting)
        context["site_icon_url"] = get_setting_file_url("site_icon")
        context["auth_background_url"] = get_setting_file_url("auth_background")
        context["app_background_url"] = get_setting_file_url("app_background")
        return context

    def post(self, request, *args, **kwargs):
        if request.POST.get("action") == "restore_defaults":
            reset_site_settings()
            write_audit_log(request, AuditLog.ACTION_POST_UPDATE, str(_("Basic site settings restored to defaults.")), user=request.user)
            messages.success(request, _("Basic settings restored to defaults."))
            return redirect("manage-site-settings")

        site_setting = self.get_site_setting()
        form = SiteSettingForm(request.POST, request.FILES, settings=site_setting)
        if not form.is_valid():
            return self.render_to_response(self.get_context_data(form=form, site_setting=site_setting))

        remove_field_map = {
            "remove_site_icon": "site_icon",
            "remove_auth_background": "auth_background",
            "remove_app_background": "app_background",
        }
        removed_labels = []
        for remove_key, field_name in remove_field_map.items():
            marked_for_removal = (request.POST.get(remove_key) or "0").strip() == "1"
            uploaded_replacement = request.FILES.get(field_name)
            if marked_for_removal and not uploaded_replacement and site_setting.get(field_name):
                delete_setting_file(field_name)
                removed_labels.append(field_name)

        form.save()
        write_audit_log(request, AuditLog.ACTION_POST_UPDATE, str(_("Basic site settings updated")), user=request.user)
        if removed_labels:
            messages.success(request, _("Pending removals were applied when saving."))
        messages.success(request, _("Basic settings updated successfully."))
        return redirect("manage-site-settings")


__all__ = ["BlogHomeView", "ManageSiteSettingView"]
