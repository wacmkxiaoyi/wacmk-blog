from django.shortcuts import get_object_or_404
from django.views.generic import ListView

from apps.blog.views.post.utils import get_visible_post_queryset, with_post_feedback_counts

from .utils import decorate_post_tags_for_display, decorate_tag_for_display, decorate_tags_for_display, get_visible_tag_queryset


class TagListView(ListView):
    template_name = "blog/tags.html"
    context_object_name = "tags"

    def get_queryset(self):
        query = (self.request.GET.get("q") or "").strip()
        queryset = get_visible_tag_queryset(self.request.user)
        if query:
            queryset = queryset.filter(name__icontains=query)
        return decorate_tags_for_display(list(queryset))

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["query"] = (self.request.GET.get("q") or "").strip()
        return context


class TagDetailView(ListView):
    template_name = "blog/tag_detail.html"
    context_object_name = "posts"
    paginate_by = 12

    def get_tag(self):
        if not hasattr(self, "tag"):
            self.tag = decorate_tag_for_display(get_object_or_404(get_visible_tag_queryset(self.request.user), slug=self.kwargs["slug"]))
        return self.tag

    def get_queryset(self):
        return decorate_post_tags_for_display(list(with_post_feedback_counts(get_visible_post_queryset(self.request.user).filter(tags=self.get_tag()).distinct())))

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["tag"] = self.get_tag()
        context["pagination_query"] = ""
        return context
