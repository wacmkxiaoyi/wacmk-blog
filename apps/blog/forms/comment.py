from django import forms
from django.urls import reverse_lazy
from django.utils.translation import gettext_lazy as _

from apps.blog.models import Comment

from .common import MarkdownTextarea


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
                "data-link-reference-label": _("Reference internal post"),
                "data-reference-title": _("Reference internal post"),
                "data-reference-kicker": _("Posts"),
                "data-reference-search-placeholder": _("Search posts"),
                "data-reference-empty-label": _("No posts found."),
                "data-image-upload-label": _("Upload image"),
                "data-table-title": _("Insert table"),
                "data-table-size-title": _("Choose table size"),
                "data-table-kicker": _("Markdown"),
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
        content = (self.cleaned_data.get("content") or "").strip()
        if not content:
            raise forms.ValidationError(_("Comment content cannot be empty."))
        return content
