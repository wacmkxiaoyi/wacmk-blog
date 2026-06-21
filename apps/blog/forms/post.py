import os

from django import forms
from django.urls import reverse
from django.urls import reverse_lazy
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

from apps.blog.auth import get_allowed_types_for_post
from apps.blog.models import Post, PostDraft, Tag
from apps.blog.utils.site import check_attachment_upload_permission, check_video_upload_permission

from apps.blog.views.media import MEDIA_UPLOAD_CONTEXT_POST

from .common import MarkdownTextarea
from .mixins import AccessScopeFormMixin


def check_post_media_upload_permission(user):
    return bool(getattr(user, "is_authenticated", False))


class BasePostEditorForm(AccessScopeFormMixin, forms.ModelForm):
    CONDITIONAL_ALLOWED_TYPES = get_allowed_types_for_post()
    ATTACHMENT_WIDGET_ATTRS = {
        "data-attachment-title": _("Upload attachment"),
        "data-attachment-kicker": _("Attachment"),
        "data-attachment-name-label": _("Attachment title"),
        "data-attachment-file-label": _("Select file"),
        "data-attachment-help": _("Upload a reusable attachment and insert it into the current content."),
        "data-attachment-confirm-label": _("Upload and insert"),
        "data-attachment-upload-label": _("Upload attachment"),
        "data-attachment-upload-url": reverse_lazy("attachment-upload"),
        "data-attachment-browser-url": reverse_lazy("attachment-mine"),
        "data-attachment-insert-uploaded-label": _("My attachments"),
        "data-attachment-browser-title": _("My attachments"),
        "data-attachment-browser-kicker": _("My attachments"),
        "data-attachment-browser-search-placeholder": _("Search attachments"),
        "data-attachment-browser-empty-label": _("No attachments found."),
        "data-attachment-browser-insert-label": _("Insert"),
        "data-attachment-browser-title-column-label": _("Title"),
        "data-attachment-browser-access-column-label": _("Access permission"),
        "data-attachment-browser-updated-column-label": _("Updated"),
        "data-attachment-browser-actions-column-label": _("Actions"),
        "data-attachment-file-required-message": _("Please choose an attachment file first."),
        "data-attachment-upload-error-title": _("Attachment upload failed"),
        "data-attachment-upload-error-message": _("Unable to upload the selected attachment right now."),
        "data-attachment-visibility-label": _("Access permission"),
        "data-attachment-access-scope-label": _("Access scope"),
        "data-attachment-vip-access-label": _("VIP access permission"),
        "data-attachment-max-size-label": _("Maximum attachment size"),
    }
    VIDEO_WIDGET_ATTRS = {
        "data-video-title": _("Insert video"),
        "data-video-kicker": _("Markdown"),
        "data-video-url-label": _("Video URL"),
        "data-video-help": _("Enter the video URL to insert an embedded player."),
        "data-video-confirm-label": _("Insert"),
        "data-video-upload-label": _("Upload video"),
        "data-video-upload-url": reverse_lazy("frontend-upload-video"),
        "data-video-upload-error-title": _("Video upload failed"),
        "data-video-upload-error-message": _("Unable to upload the selected video right now."),
        "data-video-max-size-label": _("Maximum video size"),
        "data-video-file-required-message": _("Please choose a video file first."),
    }
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
                "placeholder": _("Article title"),
            }
        ),
    )
    slug = forms.CharField(
        required=False,
        label=_("Slug"),
        widget=forms.TextInput(
            attrs={
                "class": "input-control",
                "placeholder": _("Article slug"),
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
    allow_reprint = forms.BooleanField(
        required=False,
        label=_("Allow reprint"),
        widget=forms.CheckboxInput(attrs={"class": "input-checkbox"}),
    )
    allow_quote = forms.BooleanField(
        required=False,
        initial=True,
        label=_("Allow quote"),
        widget=forms.CheckboxInput(attrs={"class": "input-checkbox"}),
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
        choices=Post.ACCESS_SCOPE_CHOICES,
        widget=forms.Select(attrs={"class": "input-control"}),
    )
    vip_access_permission = forms.ChoiceField(
        required=False,
        label=_("VIP access permission"),
        choices=VISIBILITY_EDITOR_CHOICES,
        widget=forms.Select(attrs={"class": "input-control"}),
    )
    vip_condition_rules = forms.CharField(widget=forms.HiddenInput(), required=False)
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
        fields = ["title", "slug", "summary", "cover_image", "content", "status", "allow_reprint", "allow_quote", "visibility", "condition_rules", "access_scope", "vip_access_permission", "vip_condition_rules"]

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop("user", None)
        self.editor_context = kwargs.pop("editor_context", MEDIA_UPLOAD_CONTEXT_POST)
        self.image_upload_url = kwargs.pop("image_upload_url", "")
        super().__init__(*args, **kwargs)
        self._remove_cover_image = False
        self.fields["visibility"].choices = self.VISIBILITY_EDITOR_CHOICES
        self.fields["vip_access_permission"].choices = self.VISIBILITY_EDITOR_CHOICES
        self._init_condition_rules_fields()
        content_widget = self.fields["content"].widget
        widget_attrs = {
            "data-link-title": _("Insert link"),
            "data-link-kicker": _("Markdown"),
            "data-link-display-name-label": _("Display name"),
            "data-link-url-label": _("URL"),
            "data-link-help": _("Enter display text and the target URL."),
            "data-link-confirm-label": _("Insert"),
            "data-link-cancel-label": _("Cancel"),
            "data-link-reference-label": _("Reference internal article"),
            "data-reference-title": _("Reference internal article"),
            "data-reference-kicker": _("Articles"),
            "data-reference-search-placeholder": _("Search articles"),
            "data-reference-empty-label": _("No articles found."),
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
            "data-video-title": _("Insert video"),
            "data-video-kicker": _("Markdown"),
            "data-video-url-label": _("Video URL"),
            "data-video-help": _("Enter the video URL to insert an embedded player."),
            "data-video-confirm-label": _("Insert"),
            "data-browser-previous-label": _("Previous"),
            "data-browser-next-label": _("Next"),
            "data-browser-page-label": _("Page"),
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
            "data-media-upload-context": self.editor_context,
        }
        if self.image_upload_url:
            widget_attrs["data-upload-url"] = self.image_upload_url
        else:
            widget_attrs.pop("data-upload-url", None)
        if check_post_media_upload_permission(self.user) and check_attachment_upload_permission(self.user):
            widget_attrs.update(self.ATTACHMENT_WIDGET_ATTRS)
        if check_post_media_upload_permission(self.user) and check_video_upload_permission(self.user):
            widget_attrs.update(self.VIDEO_WIDGET_ATTRS)
        content_widget.attrs.update(widget_attrs)
        if content_widget.attrs.get("data-attachment-upload-url"):
            content_widget.attrs["data-attachment-upload-url"] = f"{reverse('attachment-upload')}?context={self.editor_context}"
        if content_widget.attrs.get("data-attachment-browser-url"):
            content_widget.attrs["data-attachment-browser-url"] = f"{reverse('attachment-mine')}?context={self.editor_context}"
        if content_widget.attrs.get("data-video-upload-url"):
            content_widget.attrs["data-video-upload-url"] = f"{reverse('frontend-upload-video')}?context={self.editor_context}"
        if self.instance.pk:
            self.fields["tag_names"].initial = ", ".join(self.instance.tags.values_list("name", flat=True))

    def clean_slug(self):
        slug = (self.cleaned_data.get("slug") or "").strip()
        title = (self.cleaned_data.get("title") or "").strip()
        return slug or slugify(title)

    def clean_condition_rules(self):
        return self._clean_condition_rules_field("condition_rules")

    def clean_vip_condition_rules(self):
        return self._clean_condition_rules_field("vip_condition_rules")

    def clean(self):
        cleaned_data = super().clean()
        self._remove_cover_image = (self.data.get("remove_cover_image") or "0").strip() == "1"

        condition_rules, vip_condition_rules = self._apply_access_scope_clean(cleaned_data)
        cleaned_data = self._hash_encrypted_passwords(cleaned_data, condition_rules, vip_condition_rules)
        return cleaned_data

    def save(self, commit=True):
        existing_cover_name = self.instance.cover_image.name if getattr(self.instance, "cover_image", None) else ""
        instance = super().save(commit=False)
        uploaded_cover = self.files.get("cover_image")
        if self._remove_cover_image and not self.files.get("cover_image"):
            instance.cover_image = ""
        if commit:
            if self._remove_cover_image and not self.files.get("cover_image") and existing_cover_name:
                self.instance.cover_image.delete(save=False)
            instance.save()
            if uploaded_cover and existing_cover_name and existing_cover_name != instance.cover_image.name:
                instance.cover_image.storage.delete(existing_cover_name)
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
            self.add_error("slug", _("A published article already uses this slug."))
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
