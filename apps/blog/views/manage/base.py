from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.urls import reverse
from django.utils.translation import gettext_lazy as _


class StaffRequiredMixin(LoginRequiredMixin, UserPassesTestMixin):
    def test_func(self):
        return self.request.user.is_staff or self.request.user.is_superuser


def get_manage_home_url(tab="published"):
    if tab == "published":
        return reverse("manage-posts")
    return f"{reverse('manage-posts')}?tab={tab}"


class ManageBaseMixin(StaffRequiredMixin):
    default_sort = None
    default_sort_direction = "desc"
    sortable_fields = {}

    def get_current_sort(self):
        sort = (self.request.GET.get("sort") or "").strip()
        if sort in self.sortable_fields:
            return sort
        return self.default_sort

    def get_current_sort_direction(self, sort=None):
        current_sort = sort if sort is not None else self.get_current_sort()
        direction = (self.request.GET.get("dir") or "").strip().lower()
        if current_sort and direction in {"asc", "desc"}:
            return direction
        return self.default_sort_direction

    def apply_sort(self, queryset):
        sort = self.get_current_sort()
        if not sort:
            return queryset

        sort_config = self.sortable_fields[sort]
        if callable(sort_config):
            return sort_config(queryset, self.get_current_sort_direction(sort))

        if isinstance(sort_config, str):
            sort_fields = [sort_config]
        else:
            sort_fields = list(sort_config)

        prefix = "-" if self.get_current_sort_direction(sort) == "desc" else ""
        return queryset.order_by(*[f"{prefix}{field}" for field in sort_fields])

    def build_manage_query(self, **updates):
        params = self.request.GET.copy()
        params.pop("page", None)
        for key, value in updates.items():
            if value in (None, ""):
                params.pop(key, None)
            else:
                params[key] = value
        return params.urlencode()

    def get_header_sort_url(self, sort_key):
        is_active = self.get_current_sort() == sort_key
        next_direction = "asc"
        if is_active and self.get_current_sort_direction(sort_key) == "asc":
            next_direction = "desc"
        return f"?{self.build_manage_query(sort=sort_key, dir=next_direction)}"

    def get_manage_sort_headers(self):
        current_sort = self.get_current_sort()
        current_direction = self.get_current_sort_direction(current_sort)
        headers = {}
        for sort_key in self.sortable_fields:
            headers[sort_key] = {
                "url": self.get_header_sort_url(sort_key),
                "is_active": current_sort == sort_key,
                "direction": current_direction if current_sort == sort_key else "",
            }
        return headers

    def get_manage_context(self, **kwargs):
        context = kwargs
        context["manage_nav"] = [
            {"label": _("Basic"), "url": reverse("manage-site-settings"), "match": "manage-site-settings"},
            {"label": _("Users"), "url": reverse("manage-users"), "match": "manage-users"},
            {"label": _("Articles"), "url": reverse("manage-posts"), "match": "manage-posts"},
            {"label": _("Books"), "url": reverse("manage-books"), "match": "manage-books"},
            {"label": _("Comments"), "url": reverse("manage-comments"), "match": "manage-comments"},
            {"label": _("Audit"), "url": reverse("manage-audit"), "match": "manage-audit"},
        ]
        context["current_sort"] = self.get_current_sort() or ""
        context["current_sort_direction"] = self.get_current_sort_direction() if self.get_current_sort() else ""
        context["sort_headers"] = self.get_manage_sort_headers()
        context["pagination_query"] = self.build_manage_query()
        return context

    def get_next_url(self):
        return (self.request.GET.get("next") or self.request.POST.get("next") or "").strip()

    def get_editor_return_url(self, draft_tab=False):
        next_url = self.get_next_url()
        if next_url:
            return next_url
        if draft_tab:
            return get_manage_home_url(tab="drafts")
        return get_manage_home_url()
