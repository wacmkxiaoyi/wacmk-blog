from urllib.parse import urlencode

from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from apps.blog.models import Post, PostDraft
from apps.blog.utils.markdown import render_markdown
from apps.blog.utils.site import build_share_expiry_options


def apply_editor_payload(instance, cleaned_data):
    instance.title = cleaned_data["title"]
    instance.slug = cleaned_data["slug"]
    instance.summary = cleaned_data.get("summary", "")
    instance.content = cleaned_data["content"]
    instance.visibility = cleaned_data["visibility"]
    instance.condition_rules = cleaned_data.get("condition_rules", [])


def clone_post_to_draft(post, author):
    draft = PostDraft.objects.create(
        source_post=post,
        title=post.title,
        slug=post.slug,
        summary=post.summary,
        content=post.content,
        visibility=post.visibility,
        condition_rules=post.condition_rules,
        author=author,
    )
    if post.cover_image:
        draft.cover_image = post.cover_image.name
        draft.save(update_fields=["cover_image", "updated_at"])
    draft.tags.set(post.tags.all())
    draft.books.set(post.books.all())
    return draft


def publish_post_draft(draft):
    if draft.source_post_id:
        post = draft.source_post
    else:
        post = Post(author=draft.author, status=Post.STATUS_PUBLISHED)

    apply_editor_payload(
        post,
        {
            "title": draft.title,
            "slug": draft.slug,
            "summary": draft.summary,
            "content": draft.content,
            "visibility": draft.visibility,
            "condition_rules": draft.condition_rules,
        },
    )
    post.status = Post.STATUS_PUBLISHED
    post.save()
    post.tags.set(draft.tags.all())
    if draft.source_post_id:
        post.books.set(draft.books.all())

    if draft.cover_image:
        post.cover_image = draft.cover_image.name
        post.save(update_fields=["cover_image", "updated_at"])
    elif post.cover_image:
        post.cover_image = ""
        post.save(update_fields=["cover_image", "updated_at"])

    draft.delete()
    return post


def build_revision_choice_url(request, post, action):
    query = urlencode({"action": action, "next": request.get_full_path()})
    return f"{reverse('manage-post-revision-start', kwargs={'pk': post.pk})}?{query}"


def build_draft_preview_context(draft):
    return {
        "rendered_content": render_markdown(draft.content),
        "related_posts": Post.objects.none(),
        "comment_form": None,
        "comments": [],
        "comment_count": 0,
        "reply_parent_id": "",
        "edit_comment_id": "",
        "can_interact": False,
        "show_related_posts": False,
        "is_share_view": False,
        "can_generate_share_link": False,
        "active_share_link": None,
        "share_expiry_options": build_share_expiry_options(),
        "detail_timestamp": draft.updated_at,
        "detail_timestamp_label": _("Updated"),
    }


__all__ = ["apply_editor_payload", "build_draft_preview_context", "build_revision_choice_url", "clone_post_to_draft", "publish_post_draft"]
