from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.blog.media_paths import avatar_upload_to


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


GENDER_MALE = "male"
GENDER_FEMALE = "female"
GENDER_OTHER = "other"
GENDER_CHOICES = [
    ("", _("Unspecified")),
    (GENDER_MALE, _("Male")),
    (GENDER_FEMALE, _("Female")),
    (GENDER_OTHER, _("Other")),
]


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    avatar = models.ImageField(upload_to=avatar_upload_to, blank=True)
    description = models.TextField(blank=True, default="", max_length=500)
    money = models.IntegerField(default=0)
    points = models.IntegerField(default=0)
    last_login_reward_date = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=16, choices=GENDER_CHOICES, blank=True, default="")
    age = models.PositiveSmallIntegerField(null=True, blank=True)
    github = models.URLField(max_length=255, blank=True, default="")
    website = models.URLField(max_length=255, blank=True, default="")
    twitter = models.URLField(max_length=255, blank=True, default="")
    qq = models.CharField(max_length=20, blank=True, default="")
    show_email_on_namecard = models.BooleanField(default=False)

    def __str__(self):
        return self.user.username

    @property
    def avatar_url(self):
        if self.avatar:
            return self.avatar.url
        return ""
