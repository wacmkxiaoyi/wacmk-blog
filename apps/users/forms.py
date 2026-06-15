from django import forms
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

from .models import EmailVerificationCode


User = get_user_model()


class PrettyAuthenticationForm(AuthenticationForm):
    username = forms.CharField(
        label=_("Username or email"),
        widget=forms.TextInput(
            attrs={
                "class": "input-control",
                "placeholder": _("Enter your username or email"),
                "autocomplete": "username",
            }
        ),
    )
    password = forms.CharField(
        label=_("Password"),
        strip=False,
        widget=forms.PasswordInput(
            attrs={
                "class": "input-control input-password",
                "placeholder": _("Enter your password"),
                "autocomplete": "current-password",
            }
        ),
    )

    remember_me = forms.BooleanField(
        label=_("Remember me"),
        required=False,
    )

    error_messages = {
        "invalid_login": _("Username/email or password is incorrect."),
        "inactive": _("This account is inactive."),
    }


class RegistrationForm(forms.Form):
    username = forms.CharField(
        label=_("Username"),
        max_length=20,
        widget=forms.TextInput(
            attrs={
                "class": "input-control",
                "placeholder": _("Enter your username"),
                "autocomplete": "username",
            }
        ),
    )
    email = forms.EmailField(
        label=_("Email"),
        widget=forms.EmailInput(
            attrs={
                "class": "input-control",
                "placeholder": _("Enter your email"),
                "autocomplete": "email",
            }
        ),
    )
    verification_code = forms.CharField(
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
    password1 = forms.CharField(
        label=_("Password"),
        strip=False,
        widget=forms.PasswordInput(
            attrs={
                "class": "input-control input-password",
                "placeholder": _("Enter your password"),
                "autocomplete": "new-password",
            }
        ),
    )
    password2 = forms.CharField(
        label=_("Confirm password"),
        strip=False,
        widget=forms.PasswordInput(
            attrs={
                "class": "input-control input-password",
                "placeholder": _("Enter your password again"),
                "autocomplete": "new-password",
            }
        ),
    )

    def clean_username(self):
        username = self.cleaned_data["username"].strip()
        if User.objects.filter(username=username).exists():
            raise forms.ValidationError(_("This username is already taken."))
        return username

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError(_("This email is already registered."))
        return email

    def clean_verification_code(self):
        code = self.cleaned_data["verification_code"].strip()
        if not code.isdigit() or len(code) != 6:
            raise forms.ValidationError(_("Enter a valid 6-digit verification code."))
        return code

    def clean(self):
        cleaned_data = super().clean()
        password1 = cleaned_data.get("password1")
        password2 = cleaned_data.get("password2")
        username = cleaned_data.get("username")
        email = cleaned_data.get("email")
        code = cleaned_data.get("verification_code")

        if password1 and password2 and password1 != password2:
            self.add_error("password2", _("The two passwords do not match."))

        if password1 and username and email:
            user = User(username=username, email=email)
            try:
                validate_password(password1, user=user)
            except ValidationError as exc:
                self.add_error("password1", exc)

        if email and code:
            verification = (
                EmailVerificationCode.objects.filter(
                    email__iexact=email,
                    purpose=EmailVerificationCode.PURPOSE_REGISTER,
                )
                .order_by("-created_at")
                .first()
            )
            if verification is None or verification.code != code or not verification.is_available():
                self.add_error("verification_code", _("The verification code is invalid or expired."))
            else:
                cleaned_data["verification_record"] = verification

        return cleaned_data

    @property
    def register_available(self):
        from apps.blog.utils import get_setting
        return get_setting("enable_register") and settings.REGISTER_EMAIL_SETTINGS_READY
