from django import forms
from django.urls import reverse_lazy
from django.utils.translation import gettext_lazy as _

from apps.blog.models import Comment

from .common import MarkdownTextarea


def normalize_comment_content(value):
    return str(value or "").lstrip("\ufeff").strip()


class CommentForm(forms.ModelForm):
    content = forms.CharField(
        label=_("Comment"),
        widget=MarkdownTextarea(
            attrs={
                "class": "input-control input-textarea",
                "rows": 8,
                "data-markdown-editor": "true",
                "data-upload-url": reverse_lazy("manage-upload-image"),
                "data-preview-url": reverse_lazy("blog-markdown-preview"),
                "data-reference-search-url": reverse_lazy("manage-post-reference-search"),
                "placeholder": _("Write a comment"),
            }
        ),
    )

    class Meta:
        model = Comment
        fields = ["content"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["content"].widget.attrs.update(
            {
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
                "data-attachment-title": _("Insert attachment"),
                "data-attachment-kicker": _("Attachment"),
                "data-attachment-name-label": _("Attachment title"),
                "data-attachment-file-label": _("Select file"),
                "data-attachment-help": _("Upload a reusable attachment and insert it into the current content."),
                "data-attachment-confirm-label": _("Upload and insert"),
                "data-attachment-upload-label": _("Upload attachment"),
                "data-attachment-upload-url": reverse_lazy("attachment-upload"),
                "data-attachment-file-required-message": _("Please choose an attachment file first."),
                "data-attachment-upload-error-title": _("Attachment upload failed"),
                "data-attachment-upload-error-message": _("Unable to upload the selected attachment right now."),
                "data-attachment-visibility-label": _("Access permission"),
                "data-attachment-access-scope-label": _("Access scope"),
                "data-attachment-vip-access-label": _("VIP access permission"),
                "data-attachment-max-size-label": _("Maximum attachment size"),
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

    def clean_content(self):
        content = normalize_comment_content(self.cleaned_data.get("content"))
        if not content:
            raise forms.ValidationError(_("Comment content cannot be empty."))
        return content
