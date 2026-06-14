from django.conf import settings
from django.contrib import messages
from django.contrib.auth import update_session_auth_hash
from django.shortcuts import redirect
from django.urls import reverse
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.views.generic import TemplateView

from apps.blog.forms.profile import ProfileForm, StyledPasswordChangeForm
from apps.blog.models import AuditLog
from apps.blog.utils import build_user_business_identity_summary, get_site_setting, write_audit_log
from apps.users.models import UserProfile


def build_profile_nav():
    return [
        {"label": _("Basic information"), "url": f"{reverse('profile')}?section=basic", "section": "basic"},
        {"label": _("Account security"), "url": f"{reverse('profile')}?section=security", "section": "security"},
        {"label": _("My articles"), "url": reverse("profile-posts"), "section": "articles"},
        {"label": _("My books"), "url": reverse("profile-books"), "section": "books"},
        {"label": _("My attachments"), "url": reverse("profile-attachments"), "section": "attachments"},
        {"label": _("My comments"), "url": reverse("profile-comments"), "section": "comments"},
    ]


class ProfileView(TemplateView):
    template_name = "blog/profile.html"
    SECTION_BASIC = "basic"
    SECTION_SECURITY = "security"

    def get_profile(self):
        return UserProfile.objects.get_or_create(user=self.request.user)[0]

    def get_current_section(self):
        section = (self.request.GET.get("section") or self.request.POST.get("section") or self.SECTION_BASIC).strip().lower()
        if section in {self.SECTION_BASIC, self.SECTION_SECURITY}:
            return section
        return self.SECTION_BASIC

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        profile_obj = kwargs.get("profile") or self.get_profile()
        profile_form = kwargs.get("profile_form") or ProfileForm(instance=self.request.user, profile=profile_obj)
        current_section = kwargs.get("current_section") or self.get_current_section()
        context["profile_form"] = profile_form
        context["password_form"] = kwargs.get("password_form") or StyledPasswordChangeForm(user=self.request.user)
        context["profile"] = kwargs.get("profile") or self.get_profile()
        context["profile_business_identity"] = build_user_business_identity_summary(self.request.user, get_site_setting())
        context["email_delivery_ready"] = settings.EMAIL_DELIVERY_READY
        context["current_section"] = current_section
        context["profile_nav"] = build_profile_nav()
        context["current_email"] = profile_form.initial_email
        return context

    def post(self, request, *args, **kwargs):
        action = request.POST.get("action") or "profile"
        profile = self.get_profile()
        current_section = self.get_current_section()

        if action == "password":
            password_form = StyledPasswordChangeForm(user=request.user, data=request.POST)
            profile_form = ProfileForm(instance=request.user)
            if not password_form.is_valid():
                return self.render_to_response(
                    self.get_context_data(
                        profile_form=profile_form,
                        password_form=password_form,
                        current_section=self.SECTION_SECURITY,
                    )
                )
            user = password_form.save()
            update_session_auth_hash(request, user)
            write_audit_log(request, AuditLog.ACTION_PROFILE_UPDATE, str(_("Password changed")), user=request.user)
            messages.success(request, _("Password updated successfully."))
            return redirect(f"{reverse('profile')}?section={self.SECTION_SECURITY}")

        profile_form = ProfileForm(request.POST, instance=request.user, profile=profile)
        password_form = StyledPasswordChangeForm(user=request.user)
        avatar_file = request.FILES.get("avatar")
        remove_avatar = (request.POST.get("remove_avatar") or "0").strip() == "1"

        if not profile_form.is_valid():
            return self.render_to_response(
                self.get_context_data(
                    profile_form=profile_form,
                    password_form=password_form,
                    current_section=current_section,
                )
            )

        verification = profile_form.cleaned_data.get("verification_record")

        if remove_avatar and not avatar_file and profile.avatar:
            profile.avatar.delete(save=False)
            profile.avatar = ""

        if avatar_file:
            profile.avatar = avatar_file

        if remove_avatar and not avatar_file and not profile.avatar:
            profile.avatar = ""

        if avatar_file or remove_avatar:
            profile.save(update_fields=["avatar"])

        description = profile_form.cleaned_data.get("description", "")
        if profile.description != description:
            profile.description = description
            profile.save(update_fields=["description"])

        gender = profile_form.cleaned_data.get("gender", "")
        if profile.gender != gender:
            profile.gender = gender
            profile.save(update_fields=["gender"])

        age = profile_form.cleaned_data.get("age") or None
        if profile.age != age:
            profile.age = age
            profile.save(update_fields=["age"])

        github = profile_form.cleaned_data.get("github", "") or ""
        if profile.github != github:
            profile.github = github
            profile.save(update_fields=["github"])

        website = profile_form.cleaned_data.get("website", "") or ""
        if profile.website != website:
            profile.website = website
            profile.save(update_fields=["website"])

        twitter = profile_form.cleaned_data.get("twitter", "") or ""
        if profile.twitter != twitter:
            profile.twitter = twitter
            profile.save(update_fields=["twitter"])

        qq = profile_form.cleaned_data.get("qq", "") or ""
        if profile.qq != qq:
            profile.qq = qq
            profile.save(update_fields=["qq"])

        show_email = profile_form.cleaned_data.get("show_email_on_namecard", False)
        if profile.show_email_on_namecard != show_email:
            profile.show_email_on_namecard = show_email
            profile.save(update_fields=["show_email_on_namecard"])

        profile_form.save()
        if verification is not None:
            verification.consumed_at = timezone.now()
            verification.save(update_fields=["consumed_at"])
        write_audit_log(request, AuditLog.ACTION_PROFILE_UPDATE, str(_("Profile updated")), user=request.user)
        messages.success(request, _("Profile updated successfully."))
        return redirect(f"{reverse('profile')}?section={current_section}")


__all__ = ["ProfileView", "build_profile_nav"]
