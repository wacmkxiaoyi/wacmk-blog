from django import forms
from django.utils.translation import gettext_lazy as _


class MarkdownTextarea(forms.Textarea):
    def use_required_attribute(self, initial):
        return False


class SearchForm(forms.Form):
    q = forms.CharField(
        required=False,
        label=_("Search"),
        widget=forms.TextInput(
            attrs={
                "class": "nav-search-input",
                "placeholder": _("Search posts, books, tags, authors..."),
            }
        ),
    )
