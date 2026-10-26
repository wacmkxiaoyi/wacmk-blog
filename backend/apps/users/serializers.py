from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework import serializers

from apps.authorization_core.application.user_identity_service import UserIdentityService
from apps.resources.media_urls import avatar_url
from apps.users.services.storage import ensure_user_storage_capacity
from apps.users.services.storage import get_user_media_size

from .models import EmailVerificationCode

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    vip_level = serializers.SerializerMethodField()
    money_balance = serializers.SerializerMethodField()
    points_balance = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    def get_identity(self, user):
        identities = self.context.setdefault("_identities", {})
        if user.pk not in identities:
            identities[user.pk] = UserIdentityService.resolve(user)
        return identities[user.pk]

    def get_vip_level(self, user):
        return self.get_identity(user).vip_level

    def get_money_balance(self, user):
        return self.get_identity(user).money_balance

    def get_points_balance(self, user):
        return self.get_identity(user).points_balance

    def get_avatar_url(self, user):
        if not user.avatar:
            return ""
        return avatar_url(user)

    class Meta:
        model = User
        fields = (
            "id", "username", "email", "is_staff", "is_superuser", "vip_level",
            "money_balance", "points_balance", "date_joined", "first_name", "avatar_url",
        )
        read_only_fields = fields


class ProfileSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    vip_level = serializers.SerializerMethodField()
    storage_used_bytes = serializers.SerializerMethodField()
    remove_avatar = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = User
        fields = (
            "username", "email", "vip_level", "first_name", "avatar", "avatar_url", "remove_avatar", "description",
            "gender", "age", "github", "website", "twitter", "qq", "show_email_on_namecard", "storage_used_bytes",
        )
        read_only_fields = ("username", "email", "vip_level", "avatar_url", "storage_used_bytes")
        extra_kwargs = {
            "avatar": {"write_only": True, "required": False},
            "first_name": {"max_length": 20, "required": False, "allow_blank": True},
        }

    def get_avatar_url(self, user):
        if not user.avatar:
            return ""
        return avatar_url(user)

    def get_vip_level(self, user):
        return UserIdentityService.resolve(user).vip_level

    def get_storage_used_bytes(self, user):
        return get_user_media_size(user)

    def validate_age(self, value):
        if value is not None and not 1 <= value <= 150:
            raise serializers.ValidationError("Age must be between 1 and 150.")
        return value

    def validate_avatar(self, value):
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Avatar must be 5 MB or smaller.")
        if not value.content_type.startswith("image/"):
            raise serializers.ValidationError("Avatar must be an image file.")
        ensure_user_storage_capacity(self.instance, value.size)
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


class SendEmailChangeCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        email = value.strip().lower()
        user = self.context["request"].user
        if email == user.email.lower():
            raise serializers.ValidationError("Enter a different email address.")
        if User.objects.exclude(pk=user.pk).filter(email__iexact=email).exists():
            raise serializers.ValidationError("This email is already registered.")
        return email


class ChangeEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    verification_code = serializers.CharField(min_length=6, max_length=6)

    def validate_email(self, value):
        email = value.strip().lower()
        user = self.context["request"].user
        if email == user.email.lower():
            raise serializers.ValidationError("Enter a different email address.")
        if User.objects.exclude(pk=user.pk).filter(email__iexact=email).exists():
            raise serializers.ValidationError("This email is already registered.")
        return email

    def validate_verification_code(self, value):
        if not value.isdigit():
            raise serializers.ValidationError("Enter a valid 6-digit verification code.")
        return value

    def validate(self, attrs):
        verification = (
            EmailVerificationCode.objects
            .filter(
                email__iexact=attrs["email"],
                purpose=EmailVerificationCode.PURPOSE_EMAIL_CHANGE,
            )
            .order_by("-created_at")
            .first()
        )
        if verification is None or verification.code != attrs["verification_code"] or not verification.is_available():
            raise serializers.ValidationError({"verification_code": "The verification code is invalid or expired."})
        attrs["verification"] = verification
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_old_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        try:
            validate_password(value, self.context["request"].user)
        except ValidationError as error:
            raise serializers.ValidationError(list(error.messages))
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "Passwords do not match."})
        return attrs


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(
        label="Username or email",
        help_text="Enter your username or email address",
    )
    password = serializers.CharField(
        label="Password",
        style={"input_type": "password"},
        trim_whitespace=False,
    )
    remember_me = serializers.BooleanField(default=False, required=False)

    def validate(self, attrs):
        username = attrs.get("username")
        password = attrs.get("password")

        if not username or not password:
            raise serializers.ValidationError("Username and password are required.")

        return attrs


class SendRegisterCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("This email is already registered.")
        return email


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
        trim_whitespace=False,
    )
    password2 = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
        label="Confirm password",
        trim_whitespace=False,
    )
    verification_code = serializers.CharField(max_length=6)

    class Meta:
        model = User
        fields = ("username", "email", "verification_code", "password", "password2")

    def validate_username(self, value):
        if User.objects.filter(username=value.strip()).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value.strip()

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate_verification_code(self, value):
        if not value.isdigit() or len(value) != 6:
            raise serializers.ValidationError("Enter a valid 6-digit verification code.")
        return value

    def validate_password(self, value):
        try:
            validate_password(value)
        except ValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password2": "Passwords do not match."})

        verification = (
            EmailVerificationCode.objects
            .filter(
                email__iexact=attrs["email"],
                purpose=EmailVerificationCode.PURPOSE_REGISTER,
            )
            .order_by("-created_at")
            .first()
        )

        if verification is None or verification.code != attrs["verification_code"]:
            raise serializers.ValidationError(
                {"verification_code": "The verification code is invalid or expired."}
            )

        if not verification.is_available():
            raise serializers.ValidationError(
                {"verification_code": "The verification code is invalid or expired."}
            )

        attrs["_verification"] = verification
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        verification = validated_data.pop("_verification")
        verification_code = validated_data.pop("verification_code")
        password = validated_data.pop("password")

        user = User(**validated_data)
        user.set_password(password)
        user.save()

        verification.consumed_at = timezone.now()
        verification.save(update_fields=["consumed_at"])

        return user


class ForgotPasswordSerializer(serializers.Serializer):
    username = serializers.CharField(
        label="Username or email",
        help_text="Enter your username or email address to reset password",
    )

    def validate_username(self, value):
        try:
            if "@" in value:
                self._user = User.objects.get(email__iexact=value)
            else:
                self._user = User.objects.get_by_natural_key(value)
        except User.DoesNotExist:
            raise serializers.ValidationError("No account found with this identifier.")
        return value

    @property
    def user(self):
        return self._user


class ResetPasswordSerializer(serializers.Serializer):
    username = serializers.CharField()
    code = serializers.CharField(min_length=6, max_length=6)
    new_password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
    )

    def validate_code(self, value):
        if not value.isdigit():
            raise serializers.ValidationError("Enter a valid 6-digit code.")
        return value

    def validate_new_password(self, value):
        try:
            validate_password(value)
        except ValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value
