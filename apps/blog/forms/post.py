import os
import json

from django import forms
from django.urls import reverse_lazy
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

from apps.blog.models import Post, PostDraft, Tag
from apps.blog.permissions import (
    CONDITION_TYPE_BOOK_ONLY,
    CONDITION_TYPE_ENCRYPTED,
    CONDITION_TYPE_MONEY,
    CONDITION_TYPE_POINTS,
    get_password_condition_rule,
    hash_condition_password,
    normalize_condition_rules,
)

from .common import MarkdownTextarea


class BasePostEditorForm(forms.ModelForm):
    CONDITIONAL_ALLOWED_TYPES = [CONDITION_TYPE_MONEY, CONDITION_TYPE_POINTS, CONDITION_TYPE_ENCRYPTED, CONDITION_TYPE_BOOK_ONLY]
    VISIBILITY_EDITOR_CHOICES = [
        (Post.VISIBILITY_PUBLIC, _("Public")),
        (Post.VISIBILITY_PRIVATE, _("Private")),
        (Post.VISIBILITY_CONDITIONAL, _("Conditional")),
    ]

    title = forms.CharField(
        label=_("Title"),
        widget=forms.TextInput(
            attrs={
                "class": "input-control",
                "placeholder": _("Post title"),
            }
        ),
    )
    slug = forms.CharField(
        required=False,
        label=_("Slug"),
        widget=forms.TextInput(
            attrs={
                "class": "input-control",
                "placeholder": _("Post slug"),
            }
        ),
    )
    summary = forms.CharField(
        required=False,
        label=_("Summary"),
        widget=forms.Textarea(
            attrs={
                "class": "input-control input-textarea",
                "rows": 4,
                "placeholder": _("Short summary shown on the homepage."),
            }
        ),
    )
    content = forms.CharField(
        label=_("Content"),
        widget=MarkdownTextarea(
            attrs={
                "class": "input-control input-textarea",
                "rows": 16,
                "data-markdown-editor": "true",
                "data-upload-url": reverse_lazy("manage-upload-image"),
                "data-preview-url": reverse_lazy("blog-markdown-preview"),
                "data-reference-search-url": reverse_lazy("manage-post-reference-search"),
            }
        ),
    )
    cover_image = forms.ImageField(
        required=False,
        label=_("Cover image"),
        widget=forms.FileInput(attrs={"class": "input-control file-input", "accept": "image/*"}),
    )
    status = forms.ChoiceField(
        label=_("Status"),
        choices=Post.STATUS_CHOICES,
        widget=forms.Select(attrs={"class": "input-control"}),
        required=False,
    )
    visibility = forms.ChoiceField(
        label=_("Access permission"),
        choices=VISIBILITY_EDITOR_CHOICES,
        widget=forms.Select(attrs={"class": "input-control"}),
    )
    condition_rules = forms.CharField(widget=forms.HiddenInput(), required=False)
    tag_names = forms.CharField(
        required=False,
        label=_("Tags"),
        help_text=_("Separate tags with commas."),
        widget=forms.TextInput(
            attrs={
                "class": "input-control",
                "placeholder": _("Example: Django, Diary, Update"),
            }
        ),
    )

    class Meta:
        fields = ["title", "slug", "summary", "cover_image", "content", "status", "visibility", "condition_rules"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._remove_cover_image = False
        self.fields["visibility"].choices = self.VISIBILITY_EDITOR_CHOICES
        self.existing_password_rule_types = self.get_existing_password_rule_types()
        self.initial["condition_rules"] = json.dumps(self.get_editor_condition_rules(), ensure_ascii=True)
        if getattr(self.instance, "condition_rules", None):
            self.initial["visibility"] = Post.VISIBILITY_CONDITIONAL
        content_widget = self.fields["content"].widget
        content_widget.attrs.update(
            {
                "data-link-title": _("Insert link"),
                "data-link-kicker": _("Markdown"),
                "data-link-display-name-label": _("Display name"),
                "data-link-url-label": _("URL"),
                "data-link-help": _("Enter display text and the target URL."),
                "data-link-confirm-label": _("Insert"),
                "data-link-cancel-label": _("Cancel"),
                "data-link-reference-label": _("Reference internal post"),
                "data-reference-title": _("Reference internal post"),
                "data-reference-kicker": _("Posts"),
                "data-reference-search-placeholder": _("Search posts"),
                "data-reference-empty-label": _("No posts found."),
                "data-reference-select-label": _("Select"),
                "data-reference-selected-label": _("Selected"),
                "data-reference-confirm-label": _("Insert selected"),
                "data-image-title": _("Insert image"),
                "data-image-kicker": _("Markdown"),
                "data-image-alt-label": _("Prompt"),
                "data-image-url-label": _("Image URL"),
                "data-image-help": _("Enter image prompt text and the image URL."),
                "data-image-confirm-label": _("Insert"),
                "data-image-upload-label": _("Upload image"),
                "data-table-title": _("Insert table"),
                "data-table-size-title": _("Choose table size"),
                "data-table-kicker": _("Markdown"),
                "data-table-import-csv-label": _("Import from .csv"),
                "data-table-import-tsv-label": _("Import from .tsv"),
                "data-table-import-error-title": _("Table import failed"),
                "data-table-import-error-message": _("Please choose a valid CSV or TSV file and try again."),
                "data-table-import-empty-message": _("The selected file does not contain any table data."),
                "data-table-help-context-label": _("Right-click a cell to insert or remove rows and columns."),
                "data-table-help-paste-label": _("Use tabs or | to paste cells, one row per line."),
                "data-table-confirm-label": _("Insert"),
                "data-table-insert-row-above-label": _("Insert row above"),
                "data-table-insert-row-below-label": _("Insert row below"),
                "data-table-insert-column-left-label": _("Insert column left"),
                "data-table-insert-column-right-label": _("Insert column right"),
                "data-table-remove-row-label": _("Remove row"),
                "data-table-remove-column-label": _("Remove column"),
            }
        )
        if self.instance.pk:
            self.fields["tag_names"].initial = ", ".join(self.instance.tags.values_list("name", flat=True))

    def clean_slug(self):
        slug = (self.cleaned_data.get("slug") or "").strip()
        title = (self.cleaned_data.get("title") or "").strip()
        return slug or slugify(title)

    def get_existing_password_rule_types(self):
        existing_types = []
        for rule in getattr(self.instance, "condition_rules", []) or []:
            if not isinstance(rule, dict):
                continue
            if str(rule.get("type") or "").strip().lower() != CONDITION_TYPE_ENCRYPTED:
                continue
            if str(rule.get("value") or "").strip():
                existing_types.append(CONDITION_TYPE_ENCRYPTED)
        return existing_types

    def get_editor_condition_rules(self):
        rules = []
        for rule in getattr(self.instance, "condition_rules", []) or []:
            if not isinstance(rule, dict):
                continue
            condition_type = str(rule.get("type") or "").strip().lower()
            if not condition_type:
                continue
            if condition_type == CONDITION_TYPE_ENCRYPTED:
                rules.append({"type": condition_type})
                continue
            if "value" in rule:
                rules.append({"type": condition_type, "value": rule.get("value")})
                continue
            rules.append({"type": condition_type})
        return rules

    def clean_condition_rules(self):
        raw_value = (self.cleaned_data.get("condition_rules") or "").strip()
        if not raw_value:
            return []
        try:
            payload = json.loads(raw_value)
        except (TypeError, ValueError) as exc:
            raise forms.ValidationError(_("Invalid condition data.")) from exc
        if payload == []:
            return []
        try:
            return normalize_condition_rules(payload, allowed_types=self.CONDITIONAL_ALLOWED_TYPES)
        except forms.ValidationError:
            raise
        except Exception as exc:
            raise forms.ValidationError(exc.messages[0] if hasattr(exc, "messages") else str(exc)) from exc

    def clean(self):
        cleaned_data = super().clean()
        visibility = cleaned_data.get("visibility")
        condition_rules = list(cleaned_data.get("condition_rules") or [])
        self._remove_cover_image = (self.data.get("remove_cover_image") or "0").strip() == "1"

        if visibility == Post.VISIBILITY_CONDITIONAL:
            if not condition_rules:
                self.add_error("visibility", _("At least one complete condition is required."))
        else:
            condition_rules = []

        encrypted_rule = self.get_mutable_encrypted_rule(condition_rules)
        encrypted_password = str((encrypted_rule or {}).get("value") or "").strip()
        if encrypted_rule and not encrypted_password and CONDITION_TYPE_ENCRYPTED not in self.existing_password_rule_types:
            self.add_error("condition_rules", _("Password cannot be empty for encrypted posts."))
        if encrypted_rule and not encrypted_password and CONDITION_TYPE_ENCRYPTED in self.existing_password_rule_types:
            encrypted_rule["value"] = self.get_existing_encrypted_password()
        elif encrypted_rule:
            encrypted_rule["value"] = hash_condition_password(encrypted_password)
        cleaned_data["condition_rules"] = condition_rules
        return cleaned_data

    def get_existing_encrypted_password(self):
        existing_rule = get_password_condition_rule(getattr(self.instance, "condition_rules", []) or [], allowed_types=self.CONDITIONAL_ALLOWED_TYPES)
        return "" if existing_rule is None else str(existing_rule.get("value") or "")

    def get_mutable_encrypted_rule(self, condition_rules):
        for rule in condition_rules:
            if str(rule.get("type") or "").strip().lower() == CONDITION_TYPE_ENCRYPTED:
                return rule
        return None

    def save(self, commit=True):
        existing_cover_name = self.instance.cover_image.name if getattr(self.instance, "cover_image", None) else ""
        instance = super().save(commit=False)
        if self._remove_cover_image and not self.files.get("cover_image"):
            instance.cover_image = ""
        if commit:
            if self._remove_cover_image and not self.files.get("cover_image") and existing_cover_name:
                self.instance.cover_image.delete(save=False)
            instance.save()
        tag_objects = self.get_tag_objects()

        if commit:
            instance.tags.set(tag_objects)
        else:
            self._pending_tags = tag_objects
        return instance

    def save_m2m(self):
        super().save_m2m()
        if hasattr(self, "_pending_tags"):
            self.instance.tags.set(self._pending_tags)

    def get_tag_objects(self):
        tag_names = self.cleaned_data.get("tag_names", "")
        tag_objects = []
        for raw_name in tag_names.split(","):
            name = raw_name.strip()
            if not name:
                continue
            tag, _created = Tag.objects.get_or_create(name=name, defaults={"slug": name.lower().replace(" ", "-")})
            tag_objects.append(tag)
        return tag_objects


class PostForm(BasePostEditorForm):
    class Meta(BasePostEditorForm.Meta):
        model = Post


class PostDraftForm(BasePostEditorForm):
    class Meta(BasePostEditorForm.Meta):
        model = PostDraft

    def clean(self):
        cleaned_data = super().clean()
        slug = (cleaned_data.get("slug") or "").strip()
        source_post_id = getattr(self.instance, "source_post_id", None)
        conflicting_post = Post.objects.filter(slug=slug)
        if source_post_id:
            conflicting_post = conflicting_post.exclude(pk=source_post_id)
        if slug and conflicting_post.exists():
            self.add_error("slug", _("A published post already uses this slug."))
        return cleaned_data


class PostMarkdownImportForm(forms.Form):
    markdown_file = forms.FileField(
        label=_("Markdown file"),
        widget=forms.FileInput(attrs={"class": "input-control file-input", "accept": ".md,text/markdown,text/plain"}),
        help_text=_("Supports .md files with optional front matter fields: title, summary, tags, and slug."),
    )

    def clean_markdown_file(self):
        uploaded_file = self.cleaned_data["markdown_file"]
        extension = os.path.splitext(uploaded_file.name or "")[1].lower()
        if extension != ".md":
            raise forms.ValidationError("Only .md files are supported.")
        if not uploaded_file.size:
            raise forms.ValidationError("The uploaded file is empty.")
        try:
            self.cleaned_data["markdown_text"] = uploaded_file.read().decode("utf-8")
        except UnicodeDecodeError as exc:
            raise forms.ValidationError("The uploaded file must be a UTF-8 encoded .md file.") from exc
        finally:
            uploaded_file.seek(0)
        return uploaded_file
