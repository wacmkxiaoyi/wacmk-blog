from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


def avatar_upload_to(instance, filename):
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    suffix = f".{extension}" if extension else ""
    return f"avatars/user-{instance.pk or 'new'}/avatar{suffix}"


class EmailVerificationCode(models.Model):
    PURPOSE_REGISTER = "register"
    PURPOSE_EMAIL_CHANGE = "email_change"
    PURPOSE_CHOICES = [
        (PURPOSE_REGISTER, "register"),
        (PURPOSE_EMAIL_CHANGE, "email_change"),
    ]

    email = models.EmailField()
    code = models.CharField(max_length=6)
    purpose = models.CharField(max_length=32, choices=PURPOSE_CHOICES)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["email", "purpose", "created_at"])]

    def is_expired(self):
        return timezone.now() >= self.expires_at

    def is_available(self):
        return self.consumed_at is None and not self.is_expired()


class User(AbstractUser):
    GENDER_UNSPECIFIED = ""
    GENDER_MALE = "male"
    GENDER_FEMALE = "female"
    GENDER_OTHER = "other"
    GENDER_CHOICES = (
        (GENDER_UNSPECIFIED, "Unspecified"),
        (GENDER_MALE, "Male"),
        (GENDER_FEMALE, "Female"),
        (GENDER_OTHER, "Other"),
    )

    email = models.EmailField(unique=True, verbose_name="email address")
    money_balance = models.PositiveBigIntegerField(default=0)
    points_balance = models.PositiveBigIntegerField(default=0)
    last_login_reward_date = models.DateField(null=True, blank=True)
    avatar = models.ImageField(upload_to=avatar_upload_to, blank=True)
    description = models.TextField(blank=True, default="", max_length=500)
    gender = models.CharField(max_length=16, choices=GENDER_CHOICES, blank=True, default="")
    age = models.PositiveSmallIntegerField(null=True, blank=True)
    github = models.URLField(max_length=255, blank=True, default="")
    website = models.URLField(max_length=255, blank=True, default="")
    twitter = models.URLField(max_length=255, blank=True, default="")
    qq = models.CharField(max_length=20, blank=True, default="")
    show_email_on_namecard = models.BooleanField(default=False)

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email"]

    class Meta:
        db_table = "users"
        verbose_name = "user"
        verbose_name_plural = "users"
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["username"]),
        ]

    def __str__(self):
        return self.username

    @property
    def avatar_url(self):
        return self.avatar.url if self.avatar else ""


class UserBalanceChangeLog(models.Model):
    REASON_DAILY_LOGIN_REWARD = "daily_login_reward"
    REASON_FIRST_COMMENT_REWARD = "first_comment_reward"
    REASON_AUTHOR_REWARD = "author_reward"
    REASON_CONTENT_PURCHASE = "content_purchase"
    REASON_ADMIN_ADJUSTMENT = "admin_adjustment"
    REASON_CHOICES = (
        (REASON_DAILY_LOGIN_REWARD, "Daily login reward"),
        (REASON_FIRST_COMMENT_REWARD, "First comment reward"),
        (REASON_AUTHOR_REWARD, "Author reward"),
        (REASON_CONTENT_PURCHASE, "Content purchase"),
        (REASON_ADMIN_ADJUSTMENT, "Admin adjustment"),
    )

    user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="%(class)s_entries")
    actor = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        related_name="%(class)s_actor_entries",
        null=True,
        blank=True,
    )
    change_amount = models.BigIntegerField()
    balance_after = models.PositiveBigIntegerField()
    reason_type = models.CharField(max_length=32, choices=REASON_CHOICES)
    reason_text = models.CharField(max_length=255, blank=True, default="")
    related_object_type = models.CharField(max_length=64, blank=True, default="")
    related_object_id = models.PositiveBigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True
        ordering = ("-created_at", "-pk")
        indexes = [
            models.Index(fields=("user", "created_at")),
            models.Index(fields=("reason_type", "created_at")),
            models.Index(fields=("related_object_type", "related_object_id")),
        ]


class UserMoneyChangeLog(UserBalanceChangeLog):
    class Meta(UserBalanceChangeLog.Meta):
        db_table = "users_money_change_logs"
        verbose_name = "user money change log"
        verbose_name_plural = "user money change logs"


class UserPointsChangeLog(UserBalanceChangeLog):
    class Meta(UserBalanceChangeLog.Meta):
        db_table = "users_points_change_logs"
        verbose_name = "user points change log"
        verbose_name_plural = "user points change logs"


class PasswordResetCode(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="reset_codes",
    )
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = "password_reset_codes"
        verbose_name = "password reset code"
        verbose_name_plural = "password reset codes"

    def is_valid(self) -> bool:
        return timezone.now() < self.expires_at

    def __str__(self):
        return f"Reset code for {self.user.username}"
