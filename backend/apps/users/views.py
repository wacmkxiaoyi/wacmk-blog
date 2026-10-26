import logging
import random
import secrets
import string
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.authorization_core.application.settings_service import AuthorizationSettingsService
from apps.site_settings.application.settings_service import SiteSettingsService
from apps.site_settings.infrastructure.views import IsSiteManager

from .management import (
    UserBalanceSerializer,
    UserCreateSerializer,
    UserManagementService,
    UserPasswordResetSerializer,
    UserProfileUpdateSerializer,
    UserRoleSerializer,
    can_manage_target,
    require_target_access,
    serialize_management_user,
)

from .models import EmailVerificationCode, PasswordResetCode
from .models import UserMoneyChangeLog, UserPointsChangeLog
from .services.login_rewards import award_daily_login_reward
from .serializers import (
    ForgotPasswordSerializer,
    ChangeEmailSerializer,
    ChangePasswordSerializer,
    LoginSerializer,
    RegisterSerializer,
    ResetPasswordSerializer,
    ProfileSerializer,
    SendEmailChangeCodeSerializer,
    SendRegisterCodeSerializer,
    UserSerializer,
)

logger = logging.getLogger(__name__)
User = get_user_model()


def _is_register_available():
    return bool(AuthorizationSettingsService.get_nested(("registration", "enable_register"), True))


def _build_email_message(subject, text_template, html_template, context, recipient):
    text_body = render_to_string(text_template, context).strip()
    html_body = render_to_string(html_template, context)
    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL or None,
        to=[recipient],
    )
    message.attach_alternative(html_body, "text/html")
    return message


def _get_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


class RegisterAvailabilityMixin:
    def dispatch(self, request, *args, **kwargs):
        if not _is_register_available():
            return Response(
                {"detail": "Registration is currently unavailable."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return super().dispatch(request, *args, **kwargs)


class LoginView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = authenticate(
            request,
            username=data["username"],
            password=data["password"],
        )

        if user is None:
            return Response(
                {"detail": "Invalid username/email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            return Response(
                {"detail": "This account has been deactivated."},
                status=status.HTTP_403_FORBIDDEN,
            )

        login_reward = award_daily_login_reward(user)
        user.refresh_from_db()
        tokens = _get_tokens(user)
        return Response(
            {
                "tokens": tokens,
                "user": UserSerializer(user).data,
                "login_reward": login_reward,
            },
            status=status.HTTP_200_OK,
        )


class SendRegisterCodeView(RegisterAvailabilityMixin, APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = SendRegisterCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        resend_seconds = int(AuthorizationSettingsService.get_nested(("registration", "code_resend_seconds"), 60) or 60)
        expire_seconds = int(AuthorizationSettingsService.get_nested(("registration", "code_expire_seconds"), 600) or 600)

        latest = (
            EmailVerificationCode.objects
            .filter(email__iexact=email, purpose=EmailVerificationCode.PURPOSE_REGISTER)
            .order_by("-created_at")
            .first()
        )

        if latest and timezone.now() < latest.created_at + timedelta(seconds=resend_seconds):
            logger.info("Register code resend blocked: %s", email)
            return Response(
                {"detail": "Please wait before requesting another verification code."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        code = f"{random.randint(0, 999999):06d}"
        record = EmailVerificationCode.objects.create(
            email=email,
            code=code,
            purpose=EmailVerificationCode.PURPOSE_REGISTER,
            expires_at=timezone.now() + timedelta(seconds=expire_seconds),
        )
        logger.info("Register code generated: %s", email)

        context = {
            "app_name": settings.APP_NAME,
            "code": code,
            "expire_minutes": max(1, expire_seconds // 60),
        }

        try:
            subject = f"[{settings.APP_NAME}] Your verification code"
            message = _build_email_message(
                subject=subject,
                text_template="emails/register_code.txt",
                html_template="emails/register_code.html",
                context=context,
                recipient=email,
            )
            message.send(fail_silently=False)
            logger.info("Register code sent: %s", email)
        except Exception as e:
            record.delete()
            logger.error("Register code send failed: %s — %s", email, e)
            return Response(
                {"detail": "Failed to send verification code. Please try again later."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(
            {
                "detail": "Verification code sent.",
                "expires_in": expire_seconds,
                "resend_in": resend_seconds,
            },
            status=status.HTTP_200_OK,
        )


class RegisterView(RegisterAvailabilityMixin, generics.CreateAPIView):
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        tokens = _get_tokens(user)
        return Response(
            {
                "tokens": tokens,
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class ForgotPasswordView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.user

        code = "".join(secrets.choice(string.digits) for _ in range(6))
        logger.info("Reset code generated: user=%s", user.username)

        PasswordResetCode.objects.filter(user=user).delete()
        PasswordResetCode.objects.create(
            user=user,
            code=code,
            expires_at=timezone.now() + timezone.timedelta(minutes=10),
        )

        context = {
            "app_name": settings.APP_NAME,
            "code": code,
            "expire_minutes": 10,
        }

        recipient = user.email
        try:
            subject = f"[{settings.APP_NAME}] Your password reset code"
            message = _build_email_message(
                subject=subject,
                text_template="emails/reset_code.txt",
                html_template="emails/reset_code.html",
                context=context,
                recipient=recipient,
            )
            message.send(fail_silently=False)
            logger.info("Reset code sent: user=%s", user.username)
        except Exception as e:
            PasswordResetCode.objects.filter(user=user).delete()
            logger.error("Reset code send failed: user=%s — %s", user.username, e)
            return Response(
                {"detail": "Failed to send reset code. Please try again later."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(
            {
                "detail": "A reset code has been sent to your email.",
            },
            status=status.HTTP_200_OK,
        )


class ResetPasswordView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            if "@" in data["username"]:
                user = User.objects.get(email__iexact=data["username"])
            else:
                user = User.objects.get_by_natural_key(data["username"])
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        reset_code = (
            PasswordResetCode.objects
            .filter(user=user, code=data["code"])
            .order_by("-created_at")
            .first()
        )

        if reset_code is None or not reset_code.is_valid():
            return Response(
                {"detail": "Invalid or expired reset code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(data["new_password"])
        user.save()
        PasswordResetCode.objects.filter(user=user).delete()

        tokens = _get_tokens(user)
        return Response(
            {
                "detail": "Password has been reset successfully.",
                "tokens": tokens,
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer

    def get_object(self):
        return self.request.user


class ProfileBalanceHistoryView(APIView):
    log_model = None

    def get(self, request):
        try:
            page = max(1, int(request.query_params.get("page", 1)))
            page_size = min(100, max(1, int(request.query_params.get("page_size", 20))))
        except ValueError:
            return Response({"detail": "page and page_size must be integers."}, status=status.HTTP_400_BAD_REQUEST)

        from django.core.paginator import Paginator

        result = Paginator(self.log_model.objects.filter(user=request.user), page_size).get_page(page)
        return Response({
            "items": [{
                "id": entry.pk,
                "change_amount": entry.change_amount,
                "balance_after": entry.balance_after,
                "reason_type": entry.reason_type,
                "reason_text": entry.reason_text,
                "created_at": entry.created_at.isoformat(),
            } for entry in result.object_list],
            "total": result.paginator.count,
        })


class ProfileMoneyHistoryView(ProfileBalanceHistoryView):
    log_model = UserMoneyChangeLog


class ProfilePointsHistoryView(ProfileBalanceHistoryView):
    log_model = UserPointsChangeLog


class SendEmailChangeCodeView(APIView):
    def post(self, request):
        serializer = SendEmailChangeCodeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        resend_seconds = int(AuthorizationSettingsService.get_nested(("registration", "code_resend_seconds"), 60) or 60)
        expire_seconds = int(AuthorizationSettingsService.get_nested(("registration", "code_expire_seconds"), 600) or 600)
        latest = (
            EmailVerificationCode.objects
            .filter(email__iexact=email, purpose=EmailVerificationCode.PURPOSE_EMAIL_CHANGE)
            .order_by("-created_at")
            .first()
        )
        if latest and timezone.now() < latest.created_at + timedelta(seconds=resend_seconds):
            return Response({"detail": "Please wait before requesting another verification code."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        code = f"{random.randint(0, 999999):06d}"
        record = EmailVerificationCode.objects.create(
            email=email,
            code=code,
            purpose=EmailVerificationCode.PURPOSE_EMAIL_CHANGE,
            expires_at=timezone.now() + timedelta(seconds=expire_seconds),
        )
        context = {"app_name": settings.APP_NAME, "code": code, "expire_minutes": max(1, expire_seconds // 60)}
        try:
            message = _build_email_message(
                subject=f"[{settings.APP_NAME}] Your email verification code",
                text_template="emails/register_code.txt",
                html_template="emails/register_code.html",
                context=context,
                recipient=email,
            )
            message.send(fail_silently=False)
        except Exception as error:
            record.delete()
            logger.error("Email change code send failed: %s - %s", email, error)
            return Response({"detail": "Failed to send verification code. Please try again later."}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"detail": "Verification code sent.", "expires_in": expire_seconds, "resend_in": resend_seconds})


class ChangeEmailView(APIView):
    def patch(self, request):
        serializer = ChangeEmailSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.email = serializer.validated_data["email"]
        request.user.save(update_fields=["email"])
        verification = serializer.validated_data["verification"]
        verification.consumed_at = timezone.now()
        verification.save(update_fields=["consumed_at"])
        return Response(UserSerializer(request.user, context={"request": request}).data)


class ChangePasswordView(APIView):
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"detail": "Password updated successfully."})


class TokenRefreshView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"detail": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            return Response(
                {
                    "access": str(token.access_token),
                    "refresh": str(token),
                },
                status=status.HTTP_200_OK,
            )
        except Exception:
            return Response(
                {"detail": "Invalid or expired refresh token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class SiteConfigView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        runtime = SiteSettingsService.get_public_runtime_config()
        if request.query_params.get("version") == runtime["version"]:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(runtime, status=status.HTTP_200_OK)


class ManagedUserListView(APIView):
    permission_classes = (IsSiteManager,)
    ordering_fields = {"username", "email", "date_joined", "is_active", "role"}

    def get(self, request):
        from django.core.paginator import Paginator

        try:
            page = max(1, int(request.query_params.get("page", 1)))
            page_size = min(100, max(1, int(request.query_params.get("page_size", 20))))
        except ValueError:
            return Response({"detail": "page and page_size must be integers."}, status=status.HTTP_400_BAD_REQUEST)
        ordering = request.query_params.get("ordering", "username")
        if ordering.lstrip("-") not in self.ordering_fields:
            ordering = "username"
        result = Paginator(UserManagementService.list_users(query=request.query_params.get("query", "").strip(), ordering=ordering), page_size).get_page(page)
        return Response({"items": [serialize_management_user(user, request) for user in result.object_list], "total": result.paginator.count})

    def post(self, request):
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = UserManagementService.create(actor=request.user, values=serializer.validated_data, request=request)
        return Response(serialize_management_user(user, request), status=status.HTTP_201_CREATED)


class ManagedUserDetailView(APIView):
    permission_classes = (IsSiteManager,)

    def get_target(self, pk):
        from django.shortcuts import get_object_or_404
        return get_object_or_404(User, pk=pk)

    def get(self, request, pk):
        target = self.get_target(pk)
        require_target_access(request.user, target)
        return Response(serialize_management_user(target, request))

    def patch(self, request, pk):
        target = self.get_target(pk)
        require_target_access(request.user, target)
        serializer = UserProfileUpdateSerializer(target, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = UserManagementService.update_profile(actor=request.user, target=target, serializer=serializer, request=request)
        return Response(serialize_management_user(user, request))

    def delete(self, request, pk):
        target = self.get_target(pk)
        require_target_access(request.user, target, sensitive=True)
        if target.pk == request.user.pk:
            return Response({"detail": "You cannot delete yourself."}, status=status.HTTP_400_BAD_REQUEST)
        if target.is_superuser and not User.objects.filter(is_superuser=True).exclude(pk=target.pk).exists():
            return Response({"detail": "The last superuser cannot be deleted."}, status=status.HTTP_400_BAD_REQUEST)
        username = target.username
        from apps.resources.media_lifecycle import schedule_user_media_cleanup
        with transaction.atomic():
            schedule_user_media_cleanup(target)
            target.delete()
        from apps.site_settings.application.audit_service import AuditLogService
        AuditLogService.record(action="user.deleted", summary=f"User {username} deleted", actor=request.user, metadata={"user_id": pk}, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ManagedUserRoleView(ManagedUserDetailView):
    def patch(self, request, pk):
        target = self.get_target(pk)
        require_target_access(request.user, target, sensitive=True)
        serializer = UserRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = UserManagementService.update_role(actor=request.user, target=target, values=serializer.validated_data, request=request)
        return Response(serialize_management_user(user, request))


class ManagedUserBalancesView(ManagedUserDetailView):
    def post(self, request, pk):
        target = self.get_target(pk)
        require_target_access(request.user, target, sensitive=True)
        serializer = UserBalanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = UserManagementService.adjust_balances(actor=request.user, target=target, values=serializer.validated_data, request=request)
        return Response(serialize_management_user(user, request))


class ManagedUserPasswordView(ManagedUserDetailView):
    def post(self, request, pk):
        target = self.get_target(pk)
        require_target_access(request.user, target, sensitive=True)
        serializer = UserPasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target.set_password(serializer.validated_data["new_password"])
        target.save(update_fields=["password"])
        from apps.site_settings.application.audit_service import AuditLogService

        AuditLogService.record(action="user.password_reset", summary=f"Password reset for {target.username}", actor=request.user, metadata={"user_id": target.pk}, request=request)
        return Response({"detail": "Password reset successfully."})


class UserNamecardView(APIView):
    def get(self, request, pk):
        from django.shortcuts import get_object_or_404

        user = get_object_or_404(User.objects.filter(is_active=True), pk=pk)
        data = serialize_management_user(user, request)
        data["email"] = user.email if user.show_email_on_namecard else ""
        data["show_balances"] = bool(request.user.pk == user.pk or can_manage_target(request.user, user))
        if not data["show_balances"]:
            data.pop("money_balance")
            data.pop("points_balance")
        data["recent"] = {"posts": [], "books": [], "comments": []}
        return Response(data)
