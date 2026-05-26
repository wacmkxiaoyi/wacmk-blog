import secrets

from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db import transaction
from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.views import View
from django.views.generic import DetailView

from apps.blog.models import AuditLog, Post, PostShareLink
from apps.blog.utils import write_audit_log
from apps.blog.utils.site import SHARE_LINK_EXPIRY_OPTIONS
from apps.blog.views.manage.base import ManageBaseMixin, get_manage_home_url
from apps.blog.views.post.context import build_post_detail_context


class PostShareDetailView(DetailView):
    template_name = "blog/detail.html"
    context_object_name = "post"

    def get_object(self, queryset=None):
        share_link = get_object_or_404(PostShareLink.objects.select_related("post", "post__author"), token=self.kwargs["token"])
        if share_link.is_expired:
            raise Http404
        post = share_link.post
        if post.status != Post.STATUS_PUBLISHED or post.visibility != Post.VISIBILITY_PUBLIC:
            raise Http404
        self.share_link = share_link
        return post

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(build_post_detail_context(self.object, self.request.user, is_share_view=True, request=self.request))
        context["active_share_link"] = self.share_link
        context.setdefault("detail_timestamp", self.object.published_at)
        context.setdefault("detail_timestamp_label", _("Published"))
        return context


class PostShareLinkCreateView(LoginRequiredMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        post = get_object_or_404(Post.objects.select_related("author"), slug=kwargs["slug"])
        if post.author_id != request.user.pk:
            return JsonResponse({"ok": False, "message": str(_("You do not have permission to generate a share link."))}, status=403)
        if post.status != Post.STATUS_PUBLISHED or post.visibility != Post.VISIBILITY_PUBLIC:
            return JsonResponse({"ok": False, "message": str(_("Only published public posts can generate share links."))}, status=400)

        expiry_key = (request.POST.get("expiry") or "7d").strip()
        option = SHARE_LINK_EXPIRY_OPTIONS.get(expiry_key)
        if option is None:
            return JsonResponse({"ok": False, "message": str(_("Invalid expiry option."))}, status=400)

        expires_at = timezone.now() + option["delta"] if option["delta"] is not None else None
        with transaction.atomic():
            PostShareLink.objects.filter(post=post).delete()
            share_link = PostShareLink.objects.create(
                post=post,
                token=secrets.token_urlsafe(24),
                created_by=request.user,
                expires_at=expires_at,
            )
        absolute_url = request.build_absolute_uri(share_link.get_absolute_url())
        return JsonResponse(
            {
                "ok": True,
                "url": absolute_url,
                "expires_at": timezone.localtime(expires_at).isoformat() if expires_at is not None else None,
                "expires_label": str(option["label"]),
                "expires_display": timezone.localtime(expires_at).strftime("%Y-%m-%d %H:%M") if expires_at is not None else str(_("Never expires")),
            }
        )


class ManagePostShareLinkUpdateView(ManageBaseMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        share_link = get_object_or_404(PostShareLink.objects.select_related("post"), pk=kwargs["pk"])
        expiry_key = (request.POST.get("expiry") or "").strip()
        option = SHARE_LINK_EXPIRY_OPTIONS.get(expiry_key)
        if option is None:
            messages.error(request, _("Invalid expiry option."))
            return redirect(get_manage_home_url(tab="external-links"))

        share_link.expires_at = timezone.now() + option["delta"] if option["delta"] is not None else None
        share_link.save(update_fields=["expires_at", "updated_at"])
        write_audit_log(
            request,
            AuditLog.ACTION_POST_UPDATE,
            str(_("External link updated: %(title)s")) % {"title": share_link.post.title},
            user=request.user,
        )
        absolute_url = request.build_absolute_uri(share_link.get_absolute_url())
        expires_display = timezone.localtime(share_link.expires_at).strftime("%Y-%m-%d %H:%M") if share_link.expires_at is not None else str(_("Never expires"))
        if request.headers.get("X-Requested-With") == "XMLHttpRequest":
            return JsonResponse(
                {
                    "ok": True,
                    "url": absolute_url,
                    "expires_at": timezone.localtime(share_link.expires_at).isoformat() if share_link.expires_at is not None else None,
                    "expires_display": expires_display,
                }
            )
        messages.success(request, _("External link validity updated successfully."))
        return redirect(get_manage_home_url(tab="external-links"))


class ManagePostShareLinkDeleteView(ManageBaseMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        share_link = get_object_or_404(PostShareLink.objects.select_related("post"), pk=kwargs["pk"])
        title = share_link.post.title
        share_link.delete()
        write_audit_log(
            request,
            AuditLog.ACTION_POST_DELETE,
            str(_("External link deleted: %(title)s")) % {"title": title},
            user=request.user,
        )
        messages.success(request, _("External link deleted successfully."))
        return redirect(get_manage_home_url(tab="external-links"))


__all__ = ["ManagePostShareLinkDeleteView", "ManagePostShareLinkUpdateView", "PostShareDetailView", "PostShareLinkCreateView"]
