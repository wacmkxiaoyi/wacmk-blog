from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.paginator import EmptyPage, Paginator
from django.views.generic import TemplateView

from apps.blog.models import UserMoneyHistory
from apps.blog.views.profile import build_profile_nav


class ProfileMoneyHistoryListView(LoginRequiredMixin, TemplateView):
    template_name = "blog/profile_money_history.html"
    paginate_by = 20

    def get_queryset(self):
        return UserMoneyHistory.objects.filter(user=self.request.user)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["profile_nav"] = build_profile_nav()
        context["current_section"] = "money-history"
        queryset = self.get_queryset()
        paginator = Paginator(queryset, self.paginate_by)
        page_number = (self.request.GET.get("page") or "1").strip() or "1"
        try:
            page_obj = paginator.page(page_number)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages or 1)
        context["histories"] = page_obj.object_list
        context["page_obj"] = page_obj
        context["paginator"] = paginator
        context["is_paginated"] = paginator.num_pages > 1
        context["pagination_query"] = ""
        return context


__all__ = ["ProfileMoneyHistoryListView"]
