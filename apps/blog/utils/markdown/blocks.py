import re
import uuid

from django.utils.html import escape

from .render import render_markdown_html
from .tables import collect_pipe_table_block, is_pipe_table_header, normalize_indented_tables, normalize_nested_tables, parse_pipe_table


CALL_OUT_TITLES = {
    "note": "Note",
    "tip": "Tip",
    "important": "Important",
    "caution": "Caution",
    "warning": "Warning",
}

ADMONITION_RE = re.compile(r'^\s*\?\?\?(\+)?\s+(note|tip|warning)(?:\s+"([^"]+)")?\s*$', flags=re.IGNORECASE)
FENCED_CODE_BLOCK_RE = re.compile(r"^\s*(```+|~~~+)")


def render_list_blocks(value):
    lines = value.splitlines()
    rendered_lines = []
    index = 0

    while index < len(lines):
        line = lines[index]
        list_match = re.match(r"^(\s*)([-+*]|\d+\.)\s+(.*)$", line)

        if list_match is None:
            rendered_lines.append(line)
            index += 1
            continue

        list_indent = list_match.group(1)
        marker = list_match.group(2)
        list_tag = "ol" if marker.endswith(".") else "ul"
        items = []

        while index < len(lines):
            item_match = re.match(rf"^{re.escape(list_indent)}([-+*]|\d+\.)\s+(.*)$", lines[index])
            if item_match is None:
                break
            if (item_match.group(1).endswith(".")) != (list_tag == "ol"):
                break

            body_lines = [item_match.group(2)]
            index += 1
            while index < len(lines):
                candidate = lines[index]
                if not candidate.strip():
                    body_lines.append("")
                    index += 1
                    continue

                candidate_indent = len(candidate) - len(candidate.lstrip(" "))
                if candidate_indent <= len(list_indent):
                    break

                body_lines.append(candidate[len(list_indent) + 4:])
                index += 1

            items.append(build_list_item_html(body_lines))

        rendered_lines.append(f"<{list_tag}>" + "".join(items) + f"</{list_tag}>")

    return "\n".join(rendered_lines)


def collect_list_block(lines, start_index):
    block_lines = []
    first_match = re.match(r"^(\s*)([-+*]|\d+\.)\s+(.*)$", lines[start_index])
    cursor = start_index

    if first_match is None:
        return block_lines, start_index

    list_indent = first_match.group(1)
    list_indent_width = len(list_indent)
    is_ordered_list = first_match.group(2).endswith(".")

    while cursor < len(lines):
        candidate = lines[cursor]
        list_match = re.match(rf"^{re.escape(list_indent)}([-+*]|\d+\.)\s+(.*)$", candidate)

        if not candidate.strip():
            block_lines.append(candidate)
            cursor += 1
            continue

        if list_match is not None:
            if list_match.group(1).endswith(".") != is_ordered_list:
                break
            block_lines.append(candidate)
            cursor += 1
            continue

        candidate_indent = len(candidate) - len(candidate.lstrip(" "))
        if candidate_indent > list_indent_width:
            block_lines.append(candidate)
            cursor += 1
            continue

        break

    while block_lines and not block_lines[-1].strip():
        block_lines.pop()

    return block_lines, cursor


def build_list_item_html(body_lines):
    paragraph_lines = [body_lines[0]] if body_lines else []
    extra_blocks = []
    index = 1

    while index < len(body_lines):
        current = body_lines[index]
        if current.strip() == "":
            index += 1
            continue

        if current.strip().startswith("|"):
            table_lines = []
            while index < len(body_lines) and body_lines[index].strip().startswith("|"):
                table_lines.append(body_lines[index])
                index += 1

            table_html = parse_pipe_table(table_lines)
            if table_html:
                extra_blocks.append(table_html)
                while index < len(body_lines) and body_lines[index].strip() == "":
                    index += 1
                continue

            extra_blocks.extend(render_markdown_html("\n".join(table_lines)).splitlines())
            continue

        paragraph_lines.append(current)
        index += 1

    paragraph_html = render_markdown_html("\n".join(paragraph_lines).strip()) if paragraph_lines else ""
    if paragraph_html.startswith("<p>") and paragraph_html.endswith("</p>"):
        paragraph_html = paragraph_html[3:-4]
    return "<li>" + paragraph_html + "".join(extra_blocks) + "</li>"


def render_markdown_fragment(value):
    normalized = normalize_nested_tables(value)
    lines = normalized.splitlines()
    chunks = []
    markdown_buffer = []
    index = 0
    active_fence = None

    def flush_markdown_buffer():
        if not markdown_buffer:
            return
        chunks.append(render_markdown_html(normalize_indented_tables("\n".join(markdown_buffer))))
        markdown_buffer.clear()

    while index < len(lines):
        fence_match = FENCED_CODE_BLOCK_RE.match(lines[index])
        if fence_match is not None:
            markdown_buffer.append(lines[index])
            fence_marker = fence_match.group(1)[0]
            active_fence = None if active_fence == fence_marker else fence_marker
            index += 1
            continue

        if active_fence is not None:
            markdown_buffer.append(lines[index])
            index += 1
            continue

        if is_pipe_table_header(lines, index):
            flush_markdown_buffer()
            table_lines, index = collect_pipe_table_block(lines, index)
            table_html = parse_pipe_table(table_lines)
            if table_html:
                chunks.append(table_html)
                continue

            markdown_buffer.extend(table_lines)
            continue

        if re.match(r"^\s*(?:[-+*]|\d+\.)\s+", lines[index]) is None:
            markdown_buffer.append(lines[index])
            index += 1
            continue

        flush_markdown_buffer()
        list_lines, index = collect_list_block(lines, index)
        chunks.append(render_list_blocks("\n".join(list_lines)))

    flush_markdown_buffer()
    return "".join(chunks)


def render_markdown_blocks(value):
    lines = value.splitlines()
    chunks = []
    markdown_buffer = []
    line_count = len(lines)
    index = 0
    active_fence = None

    def flush_markdown_buffer():
        if markdown_buffer:
            chunks.append(render_markdown_fragment("\n".join(markdown_buffer)))
            markdown_buffer.clear()

    def collect_indented_block(start_index, base_indent):
        block_lines = []
        cursor = start_index

        while cursor < line_count:
            candidate = lines[cursor]
            if not candidate.strip():
                block_lines.append("")
                cursor += 1
                continue

            indent = len(candidate) - len(candidate.lstrip(" "))
            if indent < base_indent:
                break

            block_lines.append(candidate[base_indent:])
            cursor += 1

        while block_lines and not block_lines[0].strip():
            block_lines.pop(0)
        while block_lines and not block_lines[-1].strip():
            block_lines.pop()

        return block_lines, cursor

    def render_tabs(tab_items):
        tab_group_id = f"markdown-tabs-{uuid.uuid4().hex}"
        nav_html = []
        panel_html = []

        for tab_index, tab_item in enumerate(tab_items):
            is_active = tab_index == 0
            target_id = f"{tab_group_id}-panel-{tab_index}"
            nav_html.append(
                f'<button class="markdown-tab-button{(" is-active" if is_active else "")}" type="button" '
                f'data-tab-group="{tab_group_id}" data-tab-target="{target_id}" '
                f'aria-selected="{"true" if is_active else "false"}">{escape(tab_item["title"])}</button>'
            )
            panel_html.append(
                f'<section class="markdown-tab-panel{(" is-active" if is_active else "")}" '
                f'data-tab-panel="{target_id}" data-tab-group="{tab_group_id}"'
                f'{("" if is_active else " hidden")}>{render_markdown_fragment(tab_item["content"])}</section>'
            )

        return (
            '<div class="markdown-tabs">'
            '<div class="markdown-tabs-nav" role="tablist">' + "".join(nav_html) + "</div>"
            '<div class="markdown-tabs-panels">' + "".join(panel_html) + "</div>"
            "</div>"
        )

    def render_admonition(admonition_type, content_lines, title=None, is_open=False):
        rendered_content = render_markdown_fragment("\n".join(content_lines)) if content_lines else ""
        title_text = title or CALL_OUT_TITLES.get(admonition_type, admonition_type.title())
        return (
            f'<details class="markdown-admonition markdown-admonition-{admonition_type}"{(" open" if is_open else "")}>'
            f'<summary class="markdown-admonition-summary">{escape(title_text)}</summary>'
            f'<div class="markdown-admonition-body">{rendered_content}</div>'
            "</details>"
        )

    while index < line_count:
        line = lines[index]
        fence_match = FENCED_CODE_BLOCK_RE.match(line)

        if fence_match is not None:
            markdown_buffer.append(line)
            fence_marker = fence_match.group(1)[0]
            active_fence = None if active_fence == fence_marker else fence_marker
            index += 1
            continue

        if active_fence is not None:
            markdown_buffer.append(line)
            index += 1
            continue

        callout_match = re.match(r"^\s*>\s*\[!(NOTE|TIP|IMPORTANT|CAUTION|WARNING)\]\s*(.*)$", line, flags=re.IGNORECASE)
        tabs_match = re.match(r'^\s*===\s+"([^"]+)"\s*$', line)
        admonition_match = ADMONITION_RE.match(line)

        if tabs_match is not None:
            flush_markdown_buffer()
            tab_items = []

            while index < line_count:
                current_match = re.match(r'^\s*===\s+"([^"]+)"\s*$', lines[index])
                if current_match is None:
                    break

                tab_title = current_match.group(1)
                tab_content_lines, index = collect_indented_block(index + 1, 4)
                tab_items.append({
                    "title": tab_title,
                    "content": normalize_indented_tables(normalize_nested_tables("\n".join(tab_content_lines))),
                })

            if tab_items:
                chunks.append(render_tabs(tab_items))
            continue

        if admonition_match is not None:
            flush_markdown_buffer()
            is_open = bool(admonition_match.group(1))
            admonition_type = admonition_match.group(2).lower()
            admonition_title = admonition_match.group(3)
            content_lines, index = collect_indented_block(index + 1, 4)
            chunks.append(render_admonition(admonition_type, content_lines, title=admonition_title, is_open=is_open))
            continue

        if callout_match is None:
            markdown_buffer.append(line)
            index += 1
            continue

        flush_markdown_buffer()

        callout_type = callout_match.group(1).lower()
        callout_lines = []
        inline_text = callout_match.group(2).strip()
        if inline_text:
            callout_lines.append(inline_text)

        index += 1
        while index < line_count:
            quoted_match = re.match(r"^\s*>\s?(.*)$", lines[index])
            if quoted_match is None:
                break

            callout_lines.append(quoted_match.group(1))
            index += 1

        body_html = render_markdown_fragment("\n".join(callout_lines).strip()) if callout_lines else ""
        chunks.append(
            f'<blockquote class="markdown-callout markdown-callout-{callout_type}">'
            f'<p class="markdown-callout-title">{CALL_OUT_TITLES[callout_type]}</p>'
            f"{body_html}"
            "</blockquote>"
        )

    flush_markdown_buffer()
    return "".join(chunks)
