from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Case, IntegerField, Q, Value, When
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.authorization_core.application.user_identity_service import UserIdentityService
from apps.authorization_core.application.settings_service import AuthorizationSettingsService
from apps.site_settings.application.audit_service import AuditLogService
from apps.users.services.balances import set_balances
from apps.resources.media_urls import avatar_url as public_avatar_url
from apps.users.services.storage import get_user_media_size

User = get_user_model()


def is_site_manager(user):
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


def can_manage_target(actor, target):
    if not is_site_manager(actor):
        return False
    return actor.is_superuser or (not target.is_staff and not target.is_superuser)


def ensure_superuser_survives(*, target, values):
    if not target.is_superuser:
        return
    if values.get("is_superuser") is False:
        if User.objects.filter(is_superuser=True).exclude(pk=target.pk).exists():
            return
        raise ValidationError("The last superuser cannot be demoted.")


def require_target_access(actor, target, sensitive=False):
    if not can_manage_target(actor, target):
        raise PermissionDenied("You cannot manage this account.")
    if sensitive and not actor.is_superuser:
        raise PermissionDenied("Superuser permission is required for this operation.")


def serialize_management_user(user, request=None):
    identity = UserIdentityService.resolve(user)
    avatar_url = public_avatar_url(user)
    return {
        "id": user.pk,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "avatar_url": avatar_url,
        "description": user.description,
        "gender": user.gender,
        "age": user.age,
        "github": user.github,
        "website": user.website,
        "twitter": user.twitter,
        "qq": user.qq,
        "is_active": user.is_active,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "vip_level": identity.vip_level,
        "money_balance": identity.money_balance,
        "points_balance": identity.points_balance,
        "storage_used_bytes": get_user_media_size(user),
        "date_joined": user.date_joined.isoformat(),
        "can_manage": can_manage_target(request.user, user) if request else False,
        "can_manage_sensitive": bool(request and request.user.is_superuser and user.pk != request.user.pk),
    }


class UserCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=20, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_username(self, value):
        value = value.strip()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already registered.")
        return value

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(list(error.messages))
        return value


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    avatar = serializers.ImageField(write_only=True, required=False)
    remove_avatar = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = User
        fields = ("first_name", "email", "description", "gender", "age", "github", "website", "twitter", "qq", "is_active", "avatar", "remove_avatar")
        extra_kwargs = {"first_name": {"max_length": 20, "required": False}}

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.exclude(pk=self.instance.pk).filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already registered.")
        return value

    def validate_age(self, value):
        if value is not None and not 1 <= value <= 150:
            raise serializers.ValidationError("Age must be between 1 and 150.")
        return value

    def validate_avatar(self, value):
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Avatar must be 5 MB or smaller.")
        if not value.content_type.startswith("image/"):
            raise serializers.ValidationError("Avatar must be an image file.")
        return value

    def update(self, instance, validated_data):
        remove_avatar = validated_data.pop("remove_avatar", False)
        avatar = validated_data.pop("avatar", None)
        previous_avatar = instance.avatar if instance.avatar else None
        for attribute, value in validated_data.items():
            setattr(instance, attribute, value)
        if remove_avatar or avatar:
            instance.avatar = avatar or ""
        instance.save()
        if previous_avatar and (remove_avatar or avatar):
            previous_avatar.delete(save=False)
        return instance


class UserRoleSerializer(serializers.Serializer):
    is_staff = serializers.BooleanField()
    is_superuser = serializers.BooleanField()
    vip_level = serializers.IntegerField(min_value=0, required=False)

    def validate_vip_level(self, value):
        max_level = int(AuthorizationSettingsService.get_nested(("vip", "vip_max_level"), 0) or 0)
        configured_levels = AuthorizationSettingsService.get_nested(("vip", "vip_configs"), []) or []
        allowed_maximum = min(max_level, len(configured_levels))
        if value > allowed_maximum:
            raise serializers.ValidationError(f"VIP level must be between 0 and {allowed_maximum}.")
        return value


class UserBalanceSerializer(serializers.Serializer):
    money_balance = serializers.IntegerField(min_value=0)
    points_balance = serializers.IntegerField(min_value=0)
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True)


class UserPasswordResetSerializer(serializers.Serializer):
    new_password = serializers.CharField(trim_whitespace=False)

    def validate_new_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(list(error.messages))
        return value


class UserManagementService:
    @staticmethod
    def list_users(*, query, ordering):
        users = User.objects.all()
        if query:
            query_filter = Q(username__icontains=query) | Q(first_name__icontains=query) | Q(email__icontains=query)
            if query.isdigit():
                query_filter |= Q(pk=int(query))
            users = users.filter(query_filter)
        if ordering == "role":
            users = users.annotate(role_rank=Case(When(is_superuser=True, then=Value(2)), When(is_staff=True, then=Value(1)), default=Value(0), output_field=IntegerField())).order_by("role_rank", "id")
        elif ordering == "-role":
            users = users.annotate(role_rank=Case(When(is_superuser=True, then=Value(2)), When(is_staff=True, then=Value(1)), default=Value(0), output_field=IntegerField())).order_by("-role_rank", "-id")
        else:
            users = users.order_by(ordering, "-id")
        return users

    @staticmethod
    @transaction.atomic
    def create(*, actor, values, request):
        user = User.objects.create_user(**values)
        AuditLogService.record(action="user.created", summary=f"User {user.username} created", actor=actor, metadata={"user_id": user.pk}, request=request)
        return user

    @staticmethod
    @transaction.atomic
    def update_profile(*, actor, target, serializer, request):
        before_active = target.is_active
        user = serializer.save()
        action = "user.status_changed" if before_active != user.is_active else "user.updated"
        AuditLogService.record(action=action, summary=f"User {user.username} updated", actor=actor, metadata={"user_id": user.pk}, request=request)
        return user

    @staticmethod
    @transaction.atomic
    def update_role(*, actor, target, values, request):
        if target.pk == actor.pk:
            raise ValidationError("You cannot change your own management role.")
        ensure_superuser_survives(target=target, values=values)
        target.is_staff = values["is_staff"]
        target.is_superuser = values["is_superuser"]
        target.save(update_fields=["is_staff", "is_superuser"])
        if "vip_level" in values:
            target.groups.remove(*Group.objects.filter(name__regex=r"^vip_[0-9]+$"))
            if values["vip_level"]:
                group, _ = Group.objects.get_or_create(name=f"vip_{values['vip_level']}")
                target.groups.add(group)
        AuditLogService.record(action="user.role_changed", summary=f"User {target.username} role updated", actor=actor, metadata={"user_id": target.pk, "vip_level": values.get("vip_level")}, request=request)
        return target

    @staticmethod
    @transaction.atomic
    def adjust_balances(*, actor, target, values, request):
        target, money_delta, points_delta = set_balances(
            user_id=target.pk,
            money_balance=values["money_balance"],
            points_balance=values["points_balance"],
            reason_text=values.get("reason", ""),
            actor=actor,
        )
        AuditLogService.record(action="user.balance_adjusted", summary=f"User {target.username} balances adjusted", actor=actor, metadata={"user_id": target.pk, **values, "money_delta": money_delta, "points_delta": points_delta}, request=request)
        return target
