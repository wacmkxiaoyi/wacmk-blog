from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext_lazy as _
from django.views.generic import TemplateView

from apps.blog.forms.comment import normalize_comment_content
from apps.blog.models.book import Book
from apps.blog.models.comment import Comment, CommentFeedback
from apps.blog.models.post import Post
from apps.blog.utils.markdown import render_markdown
from apps.blog.utils.site import build_user_business_identity_summary, get_site_setting
from apps.blog.views.comment.utils import _build_author_vip_map
from apps.blog.views.post.utils import prepare_post_cards, with_post_feedback_counts
from apps.blog.visibility import get_book_condition_summary_items, get_book_visibility_presentation
from apps.users.models import UserProfile


class UserNamecardView(LoginRequiredMixin, TemplateView):
    template_name = "blog/namecard.html"

    def get_target_user(self):
        user_id = self.kwargs.get("user_id")
        return get_object_or_404(User, pk=user_id)

    def get_current_tab(self):
        tab = (self.request.GET.get("tab") or "basic").strip().lower()
        if tab in {"basic", "posts", "books", "comments"}:
            return tab
        return "basic"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        target_user = self.get_target_user()
        profile = UserProfile.objects.get_or_create(user=target_user)[0]
        site_setting = get_site_setting()
        business_identity = build_user_business_identity_summary(target_user, site_setting)

        current_tab = self.get_current_tab()
        context["namecard_user"] = target_user
        context["namecard_profile"] = profile
        context["namecard_business_identity"] = business_identity
        context["namecard_is_admin"] = target_user.is_staff or target_user.is_superuser
        context["namecard_nav"] = [
            {"label": _("Basic Information"), "tab": "basic"},
            {"label": _("Recent Posts"), "tab": "posts"},
            {"label": _("Recent Books"), "tab": "books"},
            {"label": _("Recent Comments"), "tab": "comments"},
        ]
        context["current_tab"] = current_tab

        if current_tab == "posts":
            posts = (
                Post.objects.select_related("author")
                .prefetch_related("tags", "books")
                .filter(
                    author=target_user,
                    status=Post.STATUS_PUBLISHED,
                    visibility__in=[Post.VISIBILITY_PUBLIC, Post.VISIBILITY_CONDITIONAL],
                )
                .order_by("-published_at", "-updated_at")[:10]
            )
            context["namecard_posts"] = prepare_post_cards(with_post_feedback_counts(posts))

        if current_tab == "books":
            books = list(
                Book.objects.filter(
                    created_by=target_user,
                    visibility__in=[Book.VISIBILITY_PUBLIC, Book.VISIBILITY_CONDITIONAL],
                )
                .annotate(post_count=Count("posts", distinct=True))
                .order_by("-created_at")[:10]
            )
            for book in books:
                    book.condition_summary_items = get_book_condition_summary_items(book)
                    book.visibility_presentation = get_book_visibility_presentation(book)
            context["namecard_books"] = books

        if current_tab == "comments":
            comments = list(
                Comment.objects
                .select_related(
                    "post", "post__author",
                    "author", "author__profile",
                    "reply_to", "reply_to__author", "reply_to__author__profile",
                )
                .prefetch_related("post__books")
                .filter(
                    author=target_user,
                    post__status=Post.STATUS_PUBLISHED,
                    post__visibility__in=[Post.VISIBILITY_PUBLIC, Post.VISIBILITY_CONDITIONAL],
                )
                .order_by("-created_at")[:20]
            )

            if comments:
                comment_ids = [c.pk for c in comments]

                feedback_counts = {
                    row["comment_id"]: {"up": row["up_count"] or 0, "down": row["down_count"] or 0}
                    for row in CommentFeedback.objects.filter(comment_id__in=comment_ids)
                    .values("comment_id")
                    .annotate(
                        up_count=Count("id", filter=Q(value=1)),
                        down_count=Count("id", filter=Q(value=-1)),
                    )
                }
                user_feedback = dict(
                    CommentFeedback.objects.filter(
                        comment_id__in=comment_ids,
                        user=self.request.user,
                    ).values_list("comment_id", "value")
                )

                author_vip_map = _build_author_vip_map(comments)

                non_private_book_ids = set(
                    Book.objects.filter(
                        pk__in=Book.objects.filter(
                            posts__comments__in=comments,
                        ).values_list("pk", flat=True),
                        visibility__in=[Book.VISIBILITY_PUBLIC, Book.VISIBILITY_CONDITIONAL],
                    ).values_list("pk", flat=True)
                )

                for c in comments:
                    c.rendered_content = render_markdown(normalize_comment_content(c.content))
                    c.is_admin = c.author.is_staff or c.author.is_superuser
                    c.author_is_vip, c.author_vip_label = author_vip_map.get(c.author_id, (False, ""))
                    c.reply_target = c.reply_to or c.parent
                    c.reply_target_is_post_author = bool(c.reply_target and c.reply_target.author_id == c.post.author_id)
                    c.reply_target_is_admin = bool(c.reply_target and (c.reply_target.author.is_staff or c.reply_target.author.is_superuser))
                    _rt_vip = author_vip_map.get(c.reply_target.author_id, (False, "")) if c.reply_target else (False, "")
                    c.reply_target_is_vip, c.reply_target_vip_label = _rt_vip
                    c.up_count = feedback_counts.get(c.pk, {}).get("up", 0)
                    c.down_count = feedback_counts.get(c.pk, {}).get("down", 0)
                    c.feedback_value = user_feedback.get(c.pk, 0)
                    c.source_url = c.post.get_absolute_url()

                    book = c.post.books.filter(pk__in=non_private_book_ids).first()
                    if book is not None:
                        c.source_type = "book"
                        c.source_title = book.name
                    else:
                        c.source_type = "article"
                        c.source_title = c.post.title

            context["namecard_comments"] = comments

        return context
