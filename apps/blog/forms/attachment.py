from django import forms
from django.utils.translation import gettext_lazy as _

from apps.blog.auth import get_allowed_types_for_attachment
from apps.blog.models import Attachment
from apps.blog.utils import get_setting

from .mixins import AccessScopeFormMixin


class AttachmentUploadForm(AccessScopeFormMixin, forms.ModelForm):
    CONDITIONAL_ALLOWED_TYPES = get_allowed_types_for_attachment()
    VISIBILITY_EDITOR_CHOICES = [
        (Attachment.VISIBILITY_PUBLIC, _("Public")),
        (Attachment.VISIBILITY_PRIVATE, _("Private")),
        (Attachment.VISIBILITY_CONDITIONAL, _("Conditional")),
    ]

    file = forms.FileField(required=True)
    title = forms.CharField(
        label=_("Attachment title"),
        max_length=200,
        widget=forms.TextInput(
            attrs={
                "class": "input-control",
                "placeholder": _("Enter attachment title"),
            }
        ),
    )
    visibility = forms.ChoiceField(
        label=_("Access permission"),
        choices=VISIBILITY_EDITOR_CHOICES,
        widget=forms.Select(attrs={"class": "input-control"}),
    )
    condition_rules = forms.CharField(widget=forms.HiddenInput(), required=False)
    access_scope = forms.ChoiceField(
        required=False,
        label=_("Access scope"),
        choices=Attachment.ACCESS_SCOPE_CHOICES,
        widget=forms.Select(attrs={"class": "input-control"}),
    )
    vip_access_permission = forms.ChoiceField(
        required=False,
        label=_("VIP access permission"),
        choices=VISIBILITY_EDITOR_CHOICES,
        widget=forms.Select(attrs={"class": "input-control"}),
    )
    vip_condition_rules = forms.CharField(widget=forms.HiddenInput(), required=False)

    class Meta:
        model = Attachment
        fields = ["title", "file", "visibility", "condition_rules", "access_scope", "vip_access_permission", "vip_condition_rules"]

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop("user", None)
        super().__init__(*args, **kwargs)
        self.fields["visibility"].choices = self.VISIBILITY_EDITOR_CHOICES
        self.fields["vip_access_permission"].choices = self.VISIBILITY_EDITOR_CHOICES
        self._init_condition_rules_fields()

    def clean_condition_rules(self):
        return self._clean_condition_rules_field("condition_rules")

    def clean_vip_condition_rules(self):
        return self._clean_condition_rules_field("vip_condition_rules")

    def clean_file(self):
        uploaded_file = self.cleaned_data["file"]
        max_size_mb = get_setting("attachment_max_size_mb") or 1
        max_size_bytes = int(max_size_mb * 1024 * 1024)
        if not uploaded_file.size:
            raise forms.ValidationError(_("The uploaded attachment is empty."))
        if uploaded_file.size > max_size_bytes:
            raise forms.ValidationError(
                _("The attachment exceeds the maximum size of %(size)s MB.") % {"size": max_size_mb}
            )
        return uploaded_file

    def clean(self):
        cleaned_data = super().clean()
        condition_rules, vip_condition_rules = self._apply_access_scope_clean(cleaned_data)
        cleaned_data = self._hash_encrypted_passwords(cleaned_data, condition_rules, vip_condition_rules)
        return cleaned_data

    def save(self, commit=True):
        instance = super().save(commit=False)
        self._apply_uploaded_file_metadata(instance)
        if self.user and not instance.uploaded_by_id:
            instance.uploaded_by = self.user
        if commit:
            instance.save()
        return instance

    def _apply_uploaded_file_metadata(self, instance):
        uploaded_file = self.cleaned_data.get("file")
        if uploaded_file is None:
            return instance
        instance.original_filename = uploaded_file.name or ""
        instance.mime_type = getattr(uploaded_file, "content_type", "") or ""
        instance.file_size = uploaded_file.size or 0
        instance.file_ext = ""
        return instance


class AttachmentUpdateForm(AttachmentUploadForm):
    file = forms.FileField(required=False)

    def clean_file(self):
        uploaded_file = self.cleaned_data.get("file")
        if uploaded_file is None:
            return None
        return super().clean_file()

    def save(self, commit=True):
        old_file_name = ""
        if self.instance.pk and self.cleaned_data.get("file") is not None:
            old_file_name = self.instance.file.name
        instance = super().save(commit=commit)
        if old_file_name and old_file_name != instance.file.name:
            instance.file.storage.delete(old_file_name)
        return instance


__all__ = ["AttachmentUpdateForm", "AttachmentUploadForm"]
