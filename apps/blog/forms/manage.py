from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from django.utils.translation import gettext_lazy as _

from apps.blog.constants import LEGACY_VIP_GROUP_NAME, get_default_business_group_name, is_business_group_name
from apps.blog.utils import build_business_identity_choices, get_or_create_site_setting, resolve_business_identity_from_group_names
from apps.users.models import GENDER_CHOICES


User = get_user_model()


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
        max_length=20,
        widget=forms.TextInput(attrs={"class": "input-control", "placeholder": _("Display name")}),
    )
    description = forms.CharField(
        required=False,
        label=_("Personal introduction"),
        max_length=500,
        widget=forms.Textarea(attrs={"class": "input-control", "rows": 3}),
    )
    gender = forms.ChoiceField(
        required=False,
        label=_("Gender"),
        choices=GENDER_CHOICES,
        widget=forms.Select(attrs={"class": "input-control"}),
    )
    age = forms.IntegerField(
        required=False,
        label=_("Age"),
        min_value=1,
        max_value=150,
        widget=forms.NumberInput(attrs={"class": "input-control", "min": "1", "max": "150"}),
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
    business_identity = forms.ChoiceField(
        label=_("Business identity"),
        required=False,
        widget=forms.Select(attrs={"class": "input-control", "data-business-identity-select": "true"}),
    )
    business_identity_touched = forms.BooleanField(required=False, widget=forms.HiddenInput())
    is_active = forms.BooleanField(required=False, label=_("Active"))
    is_staff = forms.BooleanField(required=False, label=_("Staff"))
    is_superuser = forms.BooleanField(required=False, label=_("Superuser"))
    groups = forms.ModelMultipleChoiceField(
        required=False,
        label=_("Groups"),
        queryset=Group.objects.none(),
        widget=forms.CheckboxSelectMultiple,
    )
    money = forms.IntegerField(
        required=False,
        min_value=0,
        label=_("Money"),
        widget=forms.NumberInput(attrs={"class": "input-control", "min": "0", "step": "1"}),
    )
    points = forms.IntegerField(
        required=False,
        min_value=0,
        label=_("Points"),
        widget=forms.NumberInput(attrs={"class": "input-control", "min": "0", "step": "1"}),
    )
    github = forms.URLField(
        required=False,
        label=_("GitHub"),
        widget=forms.URLInput(attrs={"class": "input-control", "placeholder": "https://github.com/..."}),
    )
    website = forms.URLField(
        required=False,
        label=_("Website"),
        widget=forms.URLInput(attrs={"class": "input-control", "placeholder": "https://..."}),
    )
    twitter = forms.URLField(
        required=False,
        label=_("Twitter"),
        widget=forms.URLInput(attrs={"class": "input-control", "placeholder": "https://x.com/..."}),
    )
    qq = forms.CharField(
        required=False,
        label=_("QQ"),
        max_length=20,
        widget=forms.TextInput(attrs={"class": "input-control", "placeholder": _("QQ number")}),
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.site_setting = get_or_create_site_setting()
        self.fields["username"].disabled = True
        self.fields["groups"].queryset = Group.objects.order_by("name")
        self.fields["role_type"].initial = self._get_initial_role_type()
        self.fields["business_identity"].choices = build_business_identity_choices(self.site_setting)
        self.fields["description"].initial = getattr(getattr(self.instance, "profile", None), "description", "")
        self.fields["gender"].initial = getattr(getattr(self.instance, "profile", None), "gender", "")
        self.fields["age"].initial = getattr(getattr(self.instance, "profile", None), "age", None)
        self.fields["money"].initial = getattr(getattr(self.instance, "profile", None), "money", 0)
        self.fields["points"].initial = getattr(getattr(self.instance, "profile", None), "points", 0)
        self.fields["github"].initial = getattr(getattr(self.instance, "profile", None), "github", "")
        self.fields["website"].initial = getattr(getattr(self.instance, "profile", None), "website", "")
        self.fields["twitter"].initial = getattr(getattr(self.instance, "profile", None), "twitter", "")
        self.fields["qq"].initial = getattr(getattr(self.instance, "profile", None), "qq", "")
        self.default_business_identity_value = get_default_business_group_name()
        self.current_business_group_names = list(self.instance.groups.values_list("name", flat=True)) if self.instance.pk else []
        self.current_unavailable_business_group_name = self._get_current_unavailable_business_group_name()
        self.fields["business_identity"].initial = self._get_initial_business_identity()
        self.fields["business_identity_touched"].initial = False
        if self.current_unavailable_business_group_name:
            self.fields["business_identity"].help_text = _(
                "Current business identity %(identity)s is preserved until you manually choose a new one."
            ) % {"identity": self._format_business_group_name(self.current_unavailable_business_group_name)}

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

    def _get_initial_business_identity(self):
        if self.is_bound:
            return self.data.get(self.add_prefix("business_identity"), self.default_business_identity_value)
        return resolve_business_identity_from_group_names(self.current_business_group_names, self.site_setting)

    def _get_current_unavailable_business_group_name(self):
        available_business_identities = {value for value, _label in self.fields["business_identity"].choices}
        business_group_names = [group_name for group_name in self.current_business_group_names if is_business_group_name(group_name)]
        for group_name in business_group_names:
            if group_name not in available_business_identities and group_name != get_default_business_group_name():
                return group_name
        return ""

    def _format_business_group_name(self, group_name):
        if not group_name:
            return ""
        if group_name == LEGACY_VIP_GROUP_NAME:
            return "VIP"
        if group_name.startswith("vip_"):
            return f"VIP {group_name.split('_', 1)[1]}"
        return group_name

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
        business_identity = cleaned_data.get("business_identity") or self.default_business_identity_value
        business_identity_touched = bool(cleaned_data.get("business_identity_touched"))
        allowed_business_identities = {value for value, _label in self.fields["business_identity"].choices}

        if password1 or password2:
            if password1 != password2:
                self.add_error("password2", _("The two passwords do not match."))
            else:
                validate_password(password1, self.instance)

        if business_identity not in allowed_business_identities:
            self.add_error("business_identity", _("Choose a valid business identity."))
        else:
            cleaned_data["business_identity"] = business_identity

        existing_groups = list(self.instance.groups.all()) if self.instance.pk else []
        preserved_group_ids = [group.pk for group in existing_groups if not is_business_group_name(group.name)]
        if self.current_unavailable_business_group_name and not business_identity_touched:
            cleaned_data["groups"] = Group.objects.filter(pk__in=[group.pk for group in existing_groups]).order_by("name")
        else:
            business_group_name = cleaned_data.get("business_identity") or self.default_business_identity_value
            target_names = [business_group_name]
            if business_group_name != get_default_business_group_name() and LEGACY_VIP_GROUP_NAME in [group.name for group in existing_groups]:
                target_names.append(LEGACY_VIP_GROUP_NAME)
            business_group_ids = []
            for group_name in target_names:
                group, _created = Group.objects.get_or_create(name=group_name)
                business_group_ids.append(group.pk)
            cleaned_data["groups"] = Group.objects.filter(pk__in=preserved_group_ids + business_group_ids).order_by("name")

        if role_type == self.ROLE_MEMBER:
            cleaned_data["is_staff"] = False
            cleaned_data["is_superuser"] = False

        for field_name in ("money", "points"):
            if cleaned_data.get(field_name) is None:
                cleaned_data[field_name] = getattr(getattr(self.instance, "profile", None), field_name, 0)

        return cleaned_data


class UserCreateForm(forms.Form):
    username = forms.CharField(
        label=_("Username"),
        max_length=150,
        widget=forms.TextInput(attrs={"class": "input-control", "placeholder": _("Username")}),
    )
    first_name = forms.CharField(
        required=False,
        label=_("Nickname"),
        max_length=30,
        widget=forms.TextInput(attrs={"class": "input-control", "placeholder": _("Display name (optional)")}),
    )
    email = forms.EmailField(
        label=_("Email"),
        widget=forms.EmailInput(attrs={"class": "input-control", "placeholder": _("Email address")}),
    )
    password1 = forms.CharField(
        label=_("Password"),
        widget=forms.PasswordInput(attrs={"class": "input-control", "placeholder": _("Password")}),
    )
    password2 = forms.CharField(
        label=_("Confirm password"),
        widget=forms.PasswordInput(attrs={"class": "input-control", "placeholder": _("Confirm password")}),
    )

    def clean_username(self):
        username = self.cleaned_data["username"].strip()
        if User.objects.filter(username__iexact=username).exists():
            raise forms.ValidationError(_("This username is already taken."))
        return username

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError(_("This email is already in use."))
        return email

    def clean(self):
        cleaned_data = super().clean()
        password1 = cleaned_data.get("password1", "")
        password2 = cleaned_data.get("password2", "")
        if password1 and password2 and password1 != password2:
            self.add_error("password2", _("The two passwords do not match."))
        if password1:
            validate_password(password1)
        return cleaned_data

    def save(self):
        username = self.cleaned_data["username"].strip()
        email = self.cleaned_data["email"].strip().lower()
        password = self.cleaned_data["password1"]
        first_name = self.cleaned_data.get("first_name", "").strip()
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
        )
        return user
