import os
import re

from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

from apps.blog.models import Post, PostDraft, Tag


def get_unique_post_slug(base_slug):
    slug_root = slugify(base_slug) or "post"
    candidate = slug_root
    suffix = 2
    while Post.objects.filter(slug=candidate).exists():
        candidate = f"{slug_root}-{suffix}"
        suffix += 1
    return candidate


def normalize_front_matter_scalar(value):
    normalized = (value or "").strip()
    if len(normalized) >= 2 and normalized[0] == normalized[-1] and normalized[0] in {'"', "'"}:
        return normalized[1:-1]
    return normalized


def parse_front_matter_tags(value):
    normalized = normalize_front_matter_scalar(value)
    if normalized.startswith("[") and normalized.endswith("]"):
        normalized = normalized[1:-1]
    return [
        tag
        for tag in [normalize_front_matter_scalar(item) for item in normalized.split(",")]
        if tag
    ]


def parse_markdown_front_matter(markdown_text):
    lines = markdown_text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, markdown_text

    closing_index = None
    for index in range(1, len(lines)):
        if lines[index].strip() == "---":
            closing_index = index
            break
    if closing_index is None:
        return {}, markdown_text

    front_matter = {}
    front_matter_lines = lines[1:closing_index]
    index = 0
    while index < len(front_matter_lines):
        line = front_matter_lines[index]
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or ":" not in line:
            index += 1
            continue

        raw_key, raw_value = line.split(":", 1)
        key = raw_key.strip().lower()
        value = raw_value.strip()
        if key not in {"title", "summary", "tags", "slug"}:
            index += 1
            continue

        if key == "summary" and value in {"|", ">"}:
            block_lines = []
            index += 1
            while index < len(front_matter_lines):
                next_line = front_matter_lines[index]
                if next_line.startswith((" ", "\t")) or not next_line.strip():
                    block_lines.append(next_line.lstrip())
                    index += 1
                    continue
                break
            if value == "|":
                front_matter[key] = "\n".join(block_lines).strip()
            else:
                front_matter[key] = " ".join(part.strip() for part in block_lines if part.strip()).strip()
            continue

        if key == "tags" and not value:
            tags = []
            index += 1
            while index < len(front_matter_lines):
                next_line = front_matter_lines[index]
                next_stripped = next_line.strip()
                if not next_stripped:
                    index += 1
                    continue
                if next_stripped.startswith("- "):
                    tag_name = normalize_front_matter_scalar(next_stripped[2:])
                    if tag_name:
                        tags.append(tag_name)
                    index += 1
                    continue
                break
            front_matter[key] = tags
            continue

        if key == "tags":
            front_matter[key] = parse_front_matter_tags(value)
        else:
            front_matter[key] = normalize_front_matter_scalar(value)
        index += 1

    body = "\n".join(lines[closing_index + 1 :]).lstrip("\r\n")
    return front_matter, body


def extract_markdown_heading_and_summary(markdown_text):
    title = ""
    summary_lines = []
    in_code_block = False

    for line in markdown_text.splitlines():
        stripped = line.strip()
        if stripped.startswith(("```", "~~~")):
            in_code_block = not in_code_block
            continue
        if in_code_block:
            continue
        if not title:
            heading_match = re.match(r"^\s{0,3}#\s+(.+?)\s*$", line)
            if heading_match:
                title = heading_match.group(1).strip()
                continue
        if summary_lines:
            if stripped:
                summary_lines.append(stripped)
                continue
            break
        if not stripped:
            continue
        if re.match(r"^\s{0,3}#{1,6}\s+", line):
            continue
        if re.match(r"^\s{0,3}([-*+]\s+|\d+\.\s+)", line):
            continue
        summary_lines.append(stripped)

    return title, " ".join(summary_lines).strip()


def get_markdown_import_title(filename, body, front_matter):
    title = (front_matter.get("title") or "").strip()
    if title:
        return title
    heading_title, _summary = extract_markdown_heading_and_summary(body)
    if heading_title:
        return heading_title
    filename_root = os.path.splitext(os.path.basename(filename or ""))[0].strip()
    if filename_root:
        return filename_root.replace("_", " ").replace("-", " ")
    return str(_("Imported post"))


def build_markdown_import_payload(markdown_text, filename):
    front_matter, body = parse_markdown_front_matter(markdown_text)
    title = get_markdown_import_title(filename, body, front_matter)
    _heading_title, fallback_summary = extract_markdown_heading_and_summary(body)
    summary = (front_matter.get("summary") or "").strip() or fallback_summary
    slug_value = (front_matter.get("slug") or "").strip() or title
    tags = front_matter.get("tags") or []
    return {
        "title": title,
        "summary": summary,
        "content": body,
        "slug": get_unique_post_slug(slug_value),
        "tags": tags,
    }


def create_markdown_import_draft(markdown_text, filename, author):
    payload = build_markdown_import_payload(markdown_text, filename)
    draft = PostDraft.objects.create(
        source_post=None,
        title=payload["title"],
        slug=payload["slug"],
        summary=payload["summary"],
        content=payload["content"],
        visibility=Post.VISIBILITY_PUBLIC,
        author=author,
    )
    tag_objects = []
    for tag_name in payload["tags"]:
        tag_slug = slugify(tag_name) or tag_name.lower().replace(" ", "-")
        tag, _created = Tag.objects.get_or_create(name=tag_name, defaults={"slug": tag_slug})
        tag_objects.append(tag)
    if tag_objects:
        draft.tags.set(tag_objects)
    return draft


__all__ = [name for name in globals() if not name.startswith("_")]
