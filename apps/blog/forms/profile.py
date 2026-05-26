from django import forms
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import PasswordChangeForm
from django.utils.translation import gettext_lazy as _

from apps.users.models import EmailVerificationCode


User = get_user_model()


class ProfileForm(forms.ModelForm):
    first_name = forms.CharField(
        required=False,
        label=_("Nickname"),
        widget=forms.TextInput(attrs={"class": "input-control", "placeholder": _("Display name")}),
    )
    email = forms.EmailField(
        label=_("Email"),
        widget=forms.EmailInput(attrs={"class": "input-control", "placeholder": _("Email address")}),
    )
    verification_code = forms.CharField(
        required=False,
        label=_("Verification code"),
        max_length=6,
        widget=forms.TextInput(
            attrs={
                "class": "input-control",
                "placeholder": _("Enter verification code"),
                "inputmode": "numeric",
                "autocomplete": "one-time-code",
            }
        ),
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        current_email = (self.instance.email or "").strip().lower() if self.instance else ""
        self.initial_email = current_email

    @property
    def requires_email_verification(self):
        if not settings.EMAIL_DELIVERY_READY:
            return False
        if not hasattr(self, "cleaned_data"):
            return False
        return (self.cleaned_data.get("email") or "") != self.initial_email

    class Meta:
        model = User
        fields = ["first_name", "email"]

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.exclude(pk=self.instance.pk).filter(email__iexact=email).exists():
            raise forms.ValidationError(_("This email is already in use."))
        return email

    def clean_verification_code(self):
        code = (self.cleaned_data.get("verification_code") or "").strip()
        if code and (not code.isdigit() or len(code) != 6):
            raise forms.ValidationError(_("Enter a valid 6-digit verification code."))
        return code

    def clean(self):
        cleaned_data = super().clean()
        email = cleaned_data.get("email") or ""
        code = cleaned_data.get("verification_code") or ""

        if not settings.EMAIL_DELIVERY_READY or email == self.initial_email:
            return cleaned_data

        if not code:
            self.add_error("verification_code", _("Verification code is required when changing email."))
            return cleaned_data

        verification = (
            EmailVerificationCode.objects.filter(
                email__iexact=email,
                purpose=EmailVerificationCode.PURPOSE_EMAIL_CHANGE,
            )
            .order_by("-created_at")
            .first()
        )
        if verification is None or verification.code != code or not verification.is_available():
            self.add_error("verification_code", _("The verification code is invalid or expired."))
            return cleaned_data

        cleaned_data["verification_record"] = verification
        return cleaned_data


class StyledPasswordChangeForm(PasswordChangeForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.widget.attrs["class"] = "input-control"
