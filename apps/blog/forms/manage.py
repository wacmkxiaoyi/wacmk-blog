from django import forms
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from django.utils.translation import gettext_lazy as _


User = get_user_model()

BUSINESS_GROUP_LABELS = {
    "normal_user": _("Normal user"),
    "vip": _("VIP user"),
}


class UserManageForm(forms.ModelForm):
    ROLE_ADMIN = "admin"
    ROLE_MEMBER = "member"
    ROLE_CHOICES = [
        (ROLE_ADMIN, _("Administrator")),
        (ROLE_MEMBER, _("Normal user")),
    ]

    first_name = forms.CharField(
        required=False,
        label=_("Nickname"),
        widget=forms.TextInput(attrs={"class": "input-control", "placeholder": _("Display name")}),
    )
    email = forms.EmailField(
        label=_("Email"),
        widget=forms.EmailInput(attrs={"class": "input-control", "placeholder": _("Email address")}),
    )
    password1 = forms.CharField(
        required=False,
        label=_("New password"),
        help_text=_("Leave blank to keep the current password."),
        widget=forms.PasswordInput(attrs={"class": "input-control"}),
    )
    password2 = forms.CharField(
        required=False,
        label=_("Confirm new password"),
        widget=forms.PasswordInput(attrs={"class": "input-control"}),
    )
    role_type = forms.ChoiceField(
        label=_("User role"),
        choices=ROLE_CHOICES,
        widget=forms.Select(attrs={"class": "input-control", "data-role-type-select": "true"}),
    )
    is_active = forms.BooleanField(required=False, label=_("Active"))
    is_staff = forms.BooleanField(required=False, label=_("Staff"))
    is_superuser = forms.BooleanField(required=False, label=_("Superuser"))
    groups = forms.ModelMultipleChoiceField(
        required=False,
        label=_("Groups"),
        queryset=Group.objects.none(),
        widget=forms.CheckboxSelectMultiple,
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["username"].disabled = True
        self.fields["groups"].queryset = Group.objects.order_by("name")
        self.fields["role_type"].initial = self._get_initial_role_type()
        selected_group_values = {str(value) for value in (self["groups"].value() or [])}
        self.default_business_group_value = ""
        self.business_group_options = []
        for group in self.fields["groups"].queryset:
            if group.name == settings.REGISTER_DEFAULT_GROUP_NAME:
                self.default_business_group_value = str(group.pk)
            self.business_group_options.append(
                {
                    "id": f"id_groups_{group.pk}",
                    "value": str(group.pk),
                    "name": group.name,
                    "label": BUSINESS_GROUP_LABELS.get(group.name, group.name),
                    "checked": str(group.pk) in selected_group_values,
                }
            )

    class Meta:
        model = User
        fields = ["username", "first_name", "email", "is_active", "is_staff", "is_superuser", "groups"]
        widgets = {
            "username": forms.TextInput(attrs={"class": "input-control"}),
        }

    def _get_initial_role_type(self):
        if self.is_bound:
            return self.data.get(self.add_prefix("role_type"), self.ROLE_MEMBER)
        if self.instance.pk and (self.instance.is_staff or self.instance.is_superuser):
            return self.ROLE_ADMIN
        return self.ROLE_MEMBER

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.exclude(pk=self.instance.pk).filter(email__iexact=email).exists():
            raise forms.ValidationError(_("This email is already in use."))
        return email

    def clean_username(self):
        return self.instance.username

    def clean(self):
        cleaned_data = super().clean()
        password1 = cleaned_data.get("password1") or ""
        password2 = cleaned_data.get("password2") or ""
        role_type = cleaned_data.get("role_type")

        if password1 or password2:
            if password1 != password2:
                self.add_error("password2", _("The two passwords do not match."))
            else:
                validate_password(password1, self.instance)

        if role_type == self.ROLE_MEMBER:
            cleaned_data["is_staff"] = False
            cleaned_data["is_superuser"] = False

        return cleaned_data
