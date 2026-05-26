import json

from django import forms
from django.contrib.auth.hashers import identify_hasher
from django.http import QueryDict
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

from apps.blog.models import Book, Post


class BookForm(forms.ModelForm):
    name = forms.CharField(
        label=_("Book name"),
        widget=forms.TextInput(
            attrs={
                "class": "input-control",
                "placeholder": _("Enter book name"),
            }
        ),
    )
    slug = forms.CharField(
        required=False,
        label=_("Slug"),
        widget=forms.TextInput(
            attrs={
                "class": "input-control",
                "placeholder": _("Book slug"),
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
                "placeholder": _("Short summary shown on the books page."),
            }
        ),
    )
    cover_image = forms.ImageField(
        required=False,
        label=_("Cover image"),
        widget=forms.FileInput(attrs={"class": "input-control file-input", "accept": "image/*"}),
    )
    visibility = forms.ChoiceField(
        label=_("Access permission"),
        choices=Book.VISIBILITY_CHOICES,
        widget=forms.Select(attrs={"class": "input-control"}),
    )
    access_password = forms.CharField(
        required=False,
        label=_("Password"),
        widget=forms.PasswordInput(
            render_value=True,
            attrs={
                "class": "input-control",
                "placeholder": _("Enter book password"),
            },
        ),
    )
    post_selection = forms.ModelMultipleChoiceField(
        required=False,
        label=_("Articles"),
        queryset=Post.objects.none(),
        widget=forms.MultipleHiddenInput,
    )
    structure = forms.CharField(widget=forms.HiddenInput(), required=False)

    class Meta:
        model = Book
        fields = ["name", "slug", "summary", "cover_image", "visibility", "access_password"]

    def __init__(self, *args, **kwargs):
        if args:
            normalized_args = list(args)
            normalized_args[0] = self.normalize_post_selection_data(normalized_args[0])
            args = tuple(normalized_args)
        elif kwargs.get("data") is not None:
            kwargs["data"] = self.normalize_post_selection_data(kwargs["data"])
        super().__init__(*args, **kwargs)
        self._remove_cover_image = False
        posts = Post.objects.filter(status=Post.STATUS_PUBLISHED).select_related("author").order_by("title")
        self.fields["post_selection"].queryset = posts
        selected_ids = {str(pk) for pk in self.get_selected_post_ids()}
        self.post_options = [
            {
                "value": str(post.pk),
                "title": post.title,
                "author": post.author.first_name or post.author.username,
                "visibility": post.visibility,
                "checked": str(post.pk) in selected_ids,
            }
            for post in posts.filter(pk__in=selected_ids) if selected_ids
        ]
        self.initial["structure"] = self.get_structure_payload()
        self.structure_script_value = self.get_structure_script_value()

    def normalize_post_selection_data(self, data):
        if data is None:
            return data
        if hasattr(data, "copy"):
            normalized = data.copy()
        else:
            normalized = QueryDict("", mutable=True)
            normalized.update(data)
        if not hasattr(normalized, "getlist"):
            return normalized
        raw_values = normalized.getlist("post_selection")
        parsed_values = self.parse_post_selection_values(raw_values)
        if raw_values != parsed_values:
            normalized.setlist("post_selection", parsed_values)
        return normalized

    def get_selected_post_ids(self):
        if self.is_bound:
            return self.parse_post_selection_values(self.data.getlist("post_selection"))
        structure_post_ids = self.extract_post_ids(self.instance.structure or [])
        if structure_post_ids:
            return structure_post_ids
        if self.instance.pk:
            return list(self.instance.posts.values_list("pk", flat=True))
        return []

    def parse_post_selection_values(self, raw_values):
        parsed_values = []
        for raw_value in raw_values:
            if not raw_value:
                continue
            parsed_values.extend([value for value in raw_value.split(",") if value])
        return parsed_values

    def get_structure_payload(self):
        return json.dumps(self.instance.structure or [], ensure_ascii=True)

    def get_structure_script_value(self):
        if self.is_bound:
            raw_value = (self.data.get("structure") or "[]").strip() or "[]"
            try:
                value = json.loads(raw_value)
            except (TypeError, ValueError):
                return []
            return value if isinstance(value, list) else []
        return self.instance.structure or []

    def clean_slug(self):
        slug = (self.cleaned_data.get("slug") or "").strip()
        name = (self.cleaned_data.get("name") or "").strip()
        return slug or slugify(name)

    def clean_access_password(self):
        password = (self.cleaned_data.get("access_password") or "").strip()
        if not password:
            return ""
        try:
            identify_hasher(password)
        except ValueError:
            return password
        return password

    def clean_post_selection(self):
        raw_values = self.parse_post_selection_values(self.data.getlist("post_selection"))
        if not raw_values:
            return self.fields["post_selection"].queryset.none()

        selected_ids = []
        seen_ids = set()
        for value in raw_values:
            try:
                post_id = int(value)
            except (TypeError, ValueError):
                raise forms.ValidationError(
                    self.fields["post_selection"].error_messages["invalid_choice"],
                    code="invalid_choice",
                    params={"value": value},
                )
            if post_id in seen_ids:
                continue
            seen_ids.add(post_id)
            selected_ids.append(post_id)

        queryset = self.fields["post_selection"].queryset.filter(pk__in=selected_ids)
        found_ids = set(queryset.values_list("pk", flat=True))
        for post_id in selected_ids:
            if post_id not in found_ids:
                raise forms.ValidationError(
                    self.fields["post_selection"].error_messages["invalid_choice"],
                    code="invalid_choice",
                    params={"value": post_id},
                )
        return queryset

    def clean_structure(self):
        raw_value = (self.cleaned_data.get("structure") or "[]").strip() or "[]"
        try:
            value = json.loads(raw_value)
        except json.JSONDecodeError as exc:
            raise forms.ValidationError(_("Invalid book structure data.")) from exc
        if not isinstance(value, list):
            raise forms.ValidationError(_("Book structure must be a list."))
        return self.normalize_structure(value)

    def clean(self):
        cleaned_data = super().clean()
        visibility = cleaned_data.get("visibility")
        password = (cleaned_data.get("access_password") or "").strip()
        self._remove_cover_image = (self.data.get("remove_cover_image") or "0").strip() == "1"
        if visibility == Book.VISIBILITY_ENCRYPTED and not password:
            existing_password = getattr(self.instance, "access_password", "")
            if existing_password:
                cleaned_data["access_password"] = existing_password
            else:
                self.add_error("access_password", _("Password cannot be empty for encrypted books."))
        if visibility != Book.VISIBILITY_ENCRYPTED:
            cleaned_data["access_password"] = ""

        selected_ids = {str(post.pk) for post in cleaned_data.get("post_selection") or []}
        structure = cleaned_data.get("structure") or []
        if not structure and selected_ids:
            structure = [{"type": "post", "post_id": int(post_id)} for post_id in selected_ids]
            cleaned_data["structure"] = structure
        structure_ids = {str(pk) for pk in self.extract_post_ids(structure)}
        if structure_ids != selected_ids:
            self.add_error("post_selection", _("Selected articles must match the book structure."))
        return cleaned_data

    def save(self, commit=True):
        existing_cover_name = self.instance.cover_image.name if getattr(self.instance, "cover_image", None) else ""
        instance = super().save(commit=False)
        instance.structure = self.cleaned_data.get("structure") or []
        if self._remove_cover_image and not self.files.get("cover_image"):
            instance.cover_image = ""
        if commit:
            if self._remove_cover_image and not self.files.get("cover_image") and existing_cover_name:
                self.instance.cover_image.delete(save=False)
            instance.save()
            instance.posts.set(self.cleaned_data.get("post_selection") or [])
        else:
            self._pending_posts = self.cleaned_data.get("post_selection") or []
        return instance

    def save_m2m(self):
        super().save_m2m()
        if hasattr(self, "_pending_posts"):
            self.instance.posts.set(self._pending_posts)

    def normalize_structure(self, items):
        normalized = []
        for item in items:
            if not isinstance(item, dict):
                raise forms.ValidationError(_("Each book structure node must be an object."))
            node_type = (item.get("type") or "").strip()
            if node_type == "post":
                post_id = item.get("post_id")
                if not post_id:
                    raise forms.ValidationError(_("Article nodes must include a post id."))
                normalized.append({"type": "post", "post_id": int(post_id)})
                continue
            if node_type == "group":
                title = (item.get("title") or "").strip()
                if not title:
                    raise forms.ValidationError(_("Group nodes must include a title."))
                normalized.append(
                    {
                        "type": "group",
                        "title": title,
                        "children": self.normalize_structure(item.get("children") or []),
                    }
                )
                continue
            raise forms.ValidationError(_("Unknown book structure node type."))
        return normalized

    def extract_post_ids(self, items):
        if isinstance(items, dict):
            items = [items]
        post_ids = []
        for item in items or []:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "post" and item.get("post_id"):
                post_ids.append(int(item["post_id"]))
            elif item.get("type") == "group":
                post_ids.extend(self.extract_post_ids(item.get("children") or []))
        return post_ids
