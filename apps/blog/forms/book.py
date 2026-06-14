import json

from django import forms
from django.http import QueryDict
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

from apps.blog.auth import get_allowed_types_for_book
from apps.blog.models import Book, Post
from apps.blog.visibility import (
    get_post_access_display,
    get_post_access_icon_presentation,
    post_has_vip_standalone,
)
from apps.blog.access.display import (
    get_post_vip_condition_summary_items,
    get_post_vip_visibility_presentation,
)

from .mixins import AccessScopeFormMixin


class BookForm(AccessScopeFormMixin, forms.ModelForm):
    CONDITIONAL_ALLOWED_TYPES = get_allowed_types_for_book()
    VISIBILITY_EDITOR_CHOICES = [
        (Book.VISIBILITY_PUBLIC, _("Public")),
        (Book.VISIBILITY_PRIVATE, _("Private")),
        (Book.VISIBILITY_CONDITIONAL, _("Conditional")),
    ]

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
        choices=VISIBILITY_EDITOR_CHOICES,
        widget=forms.Select(attrs={"class": "input-control"}),
    )
    condition_rules = forms.CharField(widget=forms.HiddenInput(), required=False)
    access_scope = forms.ChoiceField(
        required=False,
        label=_("Access scope"),
        choices=Book.ACCESS_SCOPE_CHOICES,
        widget=forms.Select(attrs={"class": "input-control"}),
    )
    vip_access_permission = forms.ChoiceField(
        required=False,
        label=_("VIP access permission"),
        choices=VISIBILITY_EDITOR_CHOICES,
        widget=forms.Select(attrs={"class": "input-control"}),
    )
    vip_condition_rules = forms.CharField(widget=forms.HiddenInput(), required=False)
    post_selection = forms.ModelMultipleChoiceField(
        required=False,
        label=_("Articles"),
        queryset=Post.objects.none(),
        widget=forms.MultipleHiddenInput,
    )
    structure = forms.CharField(widget=forms.HiddenInput(), required=False)

    class Meta:
        model = Book
        fields = ["name", "slug", "summary", "cover_image", "visibility", "condition_rules", "access_scope", "vip_access_permission", "vip_condition_rules"]

    def __init__(self, *args, **kwargs):
        user = kwargs.pop("user", None)
        request = kwargs.pop("request", None)
        self._profile_user = user
        self._request = request
        if args:
            normalized_args = list(args)
            normalized_args[0] = self.normalize_post_selection_data(normalized_args[0])
            args = tuple(normalized_args)
        elif kwargs.get("data") is not None:
            kwargs["data"] = self.normalize_post_selection_data(kwargs["data"])
        super().__init__(*args, **kwargs)
        self._remove_cover_image = False
        self.fields["visibility"].choices = self.VISIBILITY_EDITOR_CHOICES
        self.fields["vip_access_permission"].choices = self.VISIBILITY_EDITOR_CHOICES
        self._init_condition_rules_fields()
        posts = Post.objects.filter(status=Post.STATUS_PUBLISHED).select_related("author").order_by("title")
        self.fields["post_selection"].queryset = posts
        selected_ids = {str(pk) for pk in self.get_selected_post_ids()}
        self.post_options = [
            {
                "value": str(post.pk),
                "title": post.title,
                "author": post.author.first_name or post.author.username,
                "visibility": post.visibility,
                "access_display": json.dumps(get_post_access_display(post), ensure_ascii=True),
                "visibility_presentation": get_post_access_icon_presentation(post),
                "checked": str(post.pk) in selected_ids,
                "show_vip_badge": post_has_vip_standalone(post),
                "vip_condition_summary_items": json.dumps(get_post_vip_condition_summary_items(post), ensure_ascii=True) if post_has_vip_standalone(post) else "",
                "vip_visibility_presentation": json.dumps(get_post_vip_visibility_presentation(post), ensure_ascii=True) if post_has_vip_standalone(post) else "",
            }
            for post in posts.filter(pk__in=selected_ids) if selected_ids
        ]
        if self._profile_user and not (self._profile_user.is_staff or self._profile_user.is_superuser):
            self._compute_post_access_flags()
        self.initial["structure"] = self.get_structure_payload()
        self.structure_script_value = self.get_structure_script_value()

    def _compute_post_access_flags(self):
        from apps.blog.access import build_access_check

        user = self._profile_user
        for option in self.post_options:
            try:
                post_id = int(option["value"])
            except (TypeError, ValueError):
                option["can_access"] = False
                option["requires_condition"] = False
                option["condition_status"] = ""
                option["condition_money"] = ""
                option["condition_points"] = ""
                continue
            post = Post.objects.filter(pk=post_id).first()
            if not post:
                option["can_access"] = False
                option["requires_condition"] = False
                option["condition_status"] = ""
                option["condition_money"] = ""
                option["condition_points"] = ""
                continue
            option["post_url"] = post.get_absolute_url()
            if post.author_id == user.pk:
                option["can_access"] = True
                option["requires_condition"] = False
                option["condition_status"] = ""
                option["condition_money"] = ""
                option["condition_points"] = ""
                continue
            if post.visibility == Post.VISIBILITY_PRIVATE:
                option["can_access"] = False
                option["requires_condition"] = False
                option["condition_status"] = ""
                option["condition_money"] = ""
                option["condition_points"] = ""
                continue

            check = build_access_check(post, user)
            has_granted = check["all_granted"]
            has_purchase = any(c["action"] == "purchase" for c in check["conditions"])
            has_password = any(
                c["type"] == "encrypted" and c["status"] == "pending"
                for c in check["conditions"]
            )
            money_cond = next((c for c in check["conditions"] if c["type"] == "money"), {})
            points_cond = next((c for c in check["conditions"] if c["type"] == "points"), {})

            if has_password or not (has_granted or has_purchase):
                option["can_access"] = False
                option["requires_condition"] = False
                option["condition_status"] = ""
                option["condition_money"] = ""
                option["condition_points"] = ""
            elif has_granted:
                option["can_access"] = True
                option["requires_condition"] = False
                option["condition_status"] = ""
                option["condition_money"] = ""
                option["condition_points"] = ""
            else:
                option["can_access"] = True
                option["requires_condition"] = True
                option["condition_status"] = money_cond.get("status", "")
                option["condition_money"] = str(money_cond.get("requirement", ""))
                option["condition_points"] = str(points_cond.get("requirement", ""))

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
        structure_post_ids = self.get_existing_structure_post_ids()
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
        return json.dumps(self.get_existing_structure_value(), ensure_ascii=True)

    def get_structure_script_value(self):
        if self.is_bound:
            raw_value = (self.data.get("structure") or "[]").strip() or "[]"
            try:
                value = json.loads(raw_value)
            except (TypeError, ValueError):
                return []
            return value if isinstance(value, list) else []
        return self.get_existing_structure_value()

    def get_existing_structure_value(self):
        from apps.blog.views.book.utils.navigation import prune_book_structure_missing_posts

        structure = self.instance.structure or []
        structure_post_ids = self.extract_post_ids(structure)
        if not structure_post_ids:
            return structure
        existing_post_ids = set(Post.objects.filter(pk__in=structure_post_ids).values_list("pk", flat=True))
        pruned_structure, _changed = prune_book_structure_missing_posts(structure, existing_post_ids)
        return pruned_structure

    def get_existing_structure_post_ids(self):
        return self.extract_post_ids(self.get_existing_structure_value())

    def clean_slug(self):
        slug = (self.cleaned_data.get("slug") or "").strip()
        name = (self.cleaned_data.get("name") or "").strip()
        return slug or slugify(name)

    def clean_condition_rules(self):
        return self._clean_condition_rules_field("condition_rules")

    def clean_vip_condition_rules(self):
        return self._clean_condition_rules_field("vip_condition_rules")

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

        if self._profile_user and not (self._profile_user.is_staff or self._profile_user.is_superuser):
            from apps.blog.views.post.utils import can_add_post_to_book
            for post in queryset:
                if post.author_id == self._profile_user.pk:
                    continue
                if post.visibility == Post.VISIBILITY_PRIVATE:
                    raise forms.ValidationError(
                        _("You do not have permission to add \"%(title)s\" to this book.") % {"title": post.title}
                    )
                if self._request is None or not can_add_post_to_book(self._request, post):
                    raise forms.ValidationError(
                        _("You do not have permission to add \"%(title)s\" to this book.") % {"title": post.title}
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
        self._remove_cover_image = (self.data.get("remove_cover_image") or "0").strip() == "1"

        condition_rules, vip_condition_rules = self._apply_access_scope_clean(cleaned_data)
        cleaned_data = self._hash_encrypted_passwords(cleaned_data, condition_rules, vip_condition_rules)

        selected_ids = {str(post.pk) for post in cleaned_data.get("post_selection") or []}
        structure = cleaned_data.get("structure") or []
        if not structure and selected_ids:
            structure = [{"type": "post", "post_id": int(post_id)} for post_id in selected_ids]
            cleaned_data["structure"] = structure
        if self.errors.get("post_selection"):
            return cleaned_data
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
