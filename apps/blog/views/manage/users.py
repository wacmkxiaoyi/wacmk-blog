from django.conf import settings
from django.contrib import messages
from django.contrib.auth import get_user_model, update_session_auth_hash
from django.db import transaction
from django.db.models import Case, CharField, F, IntegerField, ProtectedError, Q, Value, When
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.views import View
from django.views.generic import ListView, UpdateView

from apps.blog.forms import UserManageForm
from apps.blog.models import AuditLog
from apps.blog.utils import write_audit_log
from apps.blog.views.manage.base import ManageBaseMixin
from apps.users.models import UserProfile
from apps.users.views import build_email_message


User = get_user_model()


class ManageUserListView(ManageBaseMixin, ListView):
    template_name = "blog/manage/user_list.html"
    context_object_name = "users"
    paginate_by = 20
    sortable_fields = {
        "username": ("display_name_sort", "pk"),
        "email": ("email", "pk"),
        "roles": ("role_rank", "display_name_sort", "pk"),
        "state": ("state_rank", "display_name_sort", "pk"),
    }

    def get_queryset(self):
        query = (self.request.GET.get("q") or "").strip()
        queryset = User.objects.select_related("profile").annotate(
            display_name_sort=Case(
                When(first_name="", then=F("username")),
                default=F("first_name"),
                output_field=CharField(),
            ),
            role_rank=Case(
                When(is_superuser=True, then=Value(2)),
                When(is_staff=True, then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            ),
            state_rank=Case(
                When(is_active=True, then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            ),
        )
        if query:
            queryset = queryset.filter(Q(username__icontains=query) | Q(first_name__icontains=query) | Q(email__icontains=query))
        current_sort = self.get_current_sort()
        if not current_sort:
            return queryset.order_by("pk")
        return self.apply_sort(queryset)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        query = (self.request.GET.get("q") or "").strip()
        context.update(self.get_manage_context(section="users", query=query))
        return context


class ManageUserUpdateView(ManageBaseMixin, UpdateView):
    template_name = "blog/manage/user_form.html"
    form_class = UserManageForm
    queryset = User.objects.select_related("profile")

    def form_valid(self, form):
        previous_email = self.get_object().email
        password_changed = bool(form.cleaned_data.get("password1"))
        remove_avatar = (self.request.POST.get("remove_avatar") or "0").strip() == "1"
        profile = UserProfile.objects.get_or_create(user=self.get_object())[0]
        previous_money = profile.money
        previous_points = profile.points
        response = super().form_valid(form)
        if remove_avatar and profile.avatar:
            profile.avatar.delete(save=False)
            profile.avatar = ""
            profile.save(update_fields=["avatar"])
        profile.money = max(form.cleaned_data.get("money", 0), 0)
        profile.points = max(form.cleaned_data.get("points", 0), 0)
        profile.save(update_fields=["money", "points"])
        if password_changed and self.object.pk == self.request.user.pk:
            update_session_auth_hash(self.request, self.object)
        write_audit_log(self.request, AuditLog.ACTION_USER_UPDATE, str(_("User updated: %(username)s")) % {"username": self.object.username}, user=self.request.user)
        if previous_money != profile.money:
            write_audit_log(
                self.request,
                AuditLog.ACTION_USER_ASSET_UPDATE,
                str(_("Money updated for %(username)s: %(before)s -> %(after)s")) % {"username": self.object.username, "before": previous_money, "after": profile.money},
                user=self.request.user,
            )
        if previous_points != profile.points:
            write_audit_log(
                self.request,
                AuditLog.ACTION_USER_ASSET_UPDATE,
                str(_("Points updated for %(username)s: %(before)s -> %(after)s")) % {"username": self.object.username, "before": previous_points, "after": profile.points},
                user=self.request.user,
            )
        if settings.EMAIL_DELIVERY_READY and password_changed and self.object.email:
            try:
                context = {
                    "app_name": settings.APP_NAME,
                    "username": self.object.username,
                    "new_password": form.cleaned_data["password1"],
                }
                subject = str(_("[%(app_name)s] Your password was updated")) % {"app_name": settings.APP_NAME}
                message = build_email_message(
                    subject,
                    "emails/password_changed.txt",
                    "emails/password_changed.html",
                    context,
                    self.object.email,
                )
                message.send(fail_silently=False)
            except Exception:
                messages.warning(self.request, _("User password was updated, but the password email could not be sent."))
        if settings.EMAIL_DELIVERY_READY and self.object.email and previous_email != self.object.email:
            try:
                context = {
                    "app_name": settings.APP_NAME,
                    "username": self.object.username,
                    "new_email": self.object.email,
                }
                subject = str(_("[%(app_name)s] Your email address was updated")) % {"app_name": settings.APP_NAME}
                message = build_email_message(
                    subject,
                    "emails/email_changed.txt",
                    "emails/email_changed.html",
                    context,
                    self.object.email,
                )
                message.send(fail_silently=False)
            except Exception:
                messages.warning(self.request, _("User was updated, but the email notification could not be sent."))
        messages.success(self.request, _("User updated successfully."))
        return response

    def get_success_url(self):
        return reverse("manage-users")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(self.get_manage_context(section="users", page_title=_("Edit user")))
        context["profile"] = UserProfile.objects.get_or_create(user=self.object)[0]
        context["can_delete_user"] = self.object.pk != self.request.user.pk
        context["remove_avatar_pending"] = (self.request.POST.get("remove_avatar") or "0").strip() == "1"
        return context


class ManageUserDeleteView(ManageBaseMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        user = get_object_or_404(User, pk=kwargs["pk"])
        if user.pk == request.user.pk:
            messages.error(request, _("You cannot delete your own account."))
            return redirect("manage-user-update", pk=user.pk)

        username = user.username
        try:
            user.delete()
        except ProtectedError:
            messages.error(request, _("This user cannot be deleted because related data still exists."))
            return redirect("manage-user-update", pk=user.pk)

        write_audit_log(request, AuditLog.ACTION_USER_DELETE, str(_("User deleted: %(username)s")) % {"username": username}, user=request.user)
        messages.success(request, _("User deleted successfully."))
        return redirect("manage-users")


__all__ = ["ManageUserDeleteView", "ManageUserListView", "ManageUserUpdateView"]
