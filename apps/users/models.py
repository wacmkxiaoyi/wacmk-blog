from django.conf import settings
from django.db import models
from django.utils import timezone


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


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    avatar = models.ImageField(upload_to="avatars/", blank=True)
    money = models.IntegerField(default=0)
    points = models.IntegerField(default=0)

    def __str__(self):
        return self.user.username

    @property
    def avatar_url(self):
        if self.avatar:
            return self.avatar.url
        return ""
