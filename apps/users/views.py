import random
import secrets
import string
from math import ceil
from datetime import timedelta

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.auth.views import LoginView
from django.core.exceptions import ValidationError
from django.core.mail import EmailMultiAlternatives
from django.http import JsonResponse
from django.template.loader import render_to_string
from django.shortcuts import redirect
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.views import View
from django.views.generic import FormView

from .forms import PrettyAuthenticationForm, RegistrationForm
from .models import EmailVerificationCode


User = get_user_model()


def get_register_code_expire_minutes():
    return max(1, ceil(settings.REGISTER_CODE_EXPIRE_SECONDS / 60))


def generate_temporary_password(length=16):
    uppercase = string.ascii_uppercase
    lowercase = string.ascii_lowercase
    digits = string.digits
    symbols = "!@#$%^&*()-_=+[]{}<>?"
    required_chars = [
        secrets.choice(uppercase),
        secrets.choice(lowercase),
        secrets.choice(digits),
        secrets.choice(symbols),
    ]
    all_chars = uppercase + lowercase + digits + symbols
    remaining_chars = [secrets.choice(all_chars) for _ in range(max(0, length - len(required_chars)))]
    password_chars = required_chars + remaining_chars
    random.SystemRandom().shuffle(password_chars)
    return "".join(password_chars)


def build_email_message(subject, text_template, html_template, context, recipient_email):
    text_body = render_to_string(text_template, context).strip()
    html_body = render_to_string(html_template, context)
    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[recipient_email],
    )
    message.attach_alternative(html_body, "text/html")
    return message


class RegisterAvailabilityMixin:
    def dispatch(self, request, *args, **kwargs):
        if not settings.REGISTER_AVAILABLE:
            if request.headers.get("x-requested-with") == "XMLHttpRequest":
                return JsonResponse({"ok": False, "message": str(_("Registration is currently unavailable."))}, status=404)
            return redirect("login")
        return super().dispatch(request, *args, **kwargs)


class CuteLoginView(LoginView):
    authentication_form = PrettyAuthenticationForm
    template_name = "auth/login.html"
    redirect_authenticated_user = True

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["next_url"] = self.get_redirect_url() or self.get_success_url()
        context["register_available"] = settings.REGISTER_AVAILABLE
        context["password_reset_available"] = settings.EMAIL_DELIVERY_READY
        return context

    def form_valid(self, form):
        remember_me = form.cleaned_data.get("remember_me")
        response = super().form_valid(form)
        if remember_me:
            self.request.session.set_expiry(60 * 60 * 24 * 14)
        else:
            self.request.session.set_expiry(0)
        return response


class RegisterView(RegisterAvailabilityMixin, FormView):
    form_class = RegistrationForm
    template_name = "auth/register.html"

    def get_success_url(self):
        return self.request.GET.get("next") or self.request.POST.get("next") or settings.LOGIN_URL

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["next_url"] = self.request.GET.get("next") or self.request.POST.get("next") or ""
        return context

    def form_valid(self, form):
        verification = form.cleaned_data["verification_record"]
        user = User.objects.create_user(
            username=form.cleaned_data["username"],
            email=form.cleaned_data["email"],
            password=form.cleaned_data["password1"],
        )
        group, _created = Group.objects.get_or_create(name=settings.REGISTER_DEFAULT_GROUP_NAME)
        user.groups.add(group)
        verification.consumed_at = timezone.now()
        verification.save(update_fields=["consumed_at"])
        messages.success(self.request, _("Registration successful. Please sign in."))
        return redirect(self.get_success_url())


class SendRegisterCodeView(RegisterAvailabilityMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        email = (request.POST.get("email") or "").strip().lower()
        if not email:
            return JsonResponse({"ok": False, "message": str(_("Email is required."))}, status=400)

        email_field = RegistrationForm.base_fields["email"]
        try:
            email = email_field.clean(email)
        except ValidationError:
            return JsonResponse({"ok": False, "message": str(_("Enter a valid email address."))}, status=400)

        if User.objects.filter(email__iexact=email).exists():
            return JsonResponse({"ok": False, "message": str(_("This email is already registered."))}, status=400)

        latest_code = (
            EmailVerificationCode.objects.filter(
                email__iexact=email,
                purpose=EmailVerificationCode.PURPOSE_REGISTER,
            )
            .order_by("-created_at")
            .first()
        )
        if latest_code and timezone.now() < latest_code.created_at + timedelta(seconds=settings.REGISTER_CODE_RESEND_SECONDS):
            return JsonResponse(
                {
                    "ok": False,
                    "message": str(_("Please wait before requesting another verification code.")),
                },
                status=429,
            )

        code = f"{random.randint(0, 999999):06d}"
        EmailVerificationCode.objects.create(
            email=email,
            code=code,
            purpose=EmailVerificationCode.PURPOSE_REGISTER,
            expires_at=timezone.now() + timedelta(seconds=settings.REGISTER_CODE_EXPIRE_SECONDS),
        )
        expire_minutes = get_register_code_expire_minutes()
        context = {
            "app_name": settings.APP_NAME,
            "code": code,
            "expire_minutes": expire_minutes,
        }
        subject = str(_("[%(app_name)s] Your verification code")) % {"app_name": settings.APP_NAME}
        message = build_email_message(
            subject,
            "emails/register_code.txt",
            "emails/register_code.html",
            context,
            email,
        )
        message.send(fail_silently=False)
        return JsonResponse({"ok": True, "message": str(_("Verification code sent."))})


class ForgotPasswordView(View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        if not settings.EMAIL_DELIVERY_READY:
            return JsonResponse(
                {"ok": False, "message": str(_("Password reset is currently unavailable."))},
                status=503,
            )

        username = (request.POST.get("username") or "").strip()
        if not username:
            return JsonResponse({"ok": False, "message": ""}, status=400)

        user = User.objects.filter(username=username).first()
        if user is None or not user.email:
            return JsonResponse({"ok": True, "message": str(_("Password reset successful. Please check your email."))})

        original_password = user.password
        temporary_password = generate_temporary_password()
        user.set_password(temporary_password)
        user.save(update_fields=["password"])

        try:
            context = {
                "app_name": settings.APP_NAME,
                "temporary_password": temporary_password,
            }
            subject = str(_("[%(app_name)s] Your temporary password")) % {"app_name": settings.APP_NAME}
            message = build_email_message(
                subject,
                "emails/reset_password.txt",
                "emails/reset_password.html",
                context,
                user.email,
            )
            message.send(fail_silently=False)
        except Exception:
            user.password = original_password
            user.save(update_fields=["password"])
            raise

        return JsonResponse({"ok": True, "message": str(_("Password reset successful. Please check your email."))})
