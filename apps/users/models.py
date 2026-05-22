from django.db import models
from django.utils import timezone


class EmailVerificationCode(models.Model):
    PURPOSE_REGISTER = "register"
    PURPOSE_CHOICES = [(PURPOSE_REGISTER, "register")]

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
