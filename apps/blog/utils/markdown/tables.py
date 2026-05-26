import re

from .render import render_inline_markdown


TABLE_SEPARATOR_RE = re.compile(r"^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$")


def normalize_nested_tables(value):
    lines = value.splitlines()
    normalized_lines = []
    index = 0

    while index < len(lines):
        line = lines[index]
        normalized_lines.append(line)

        list_match = re.match(r"^(\s*)([-+*]|\d+\.)\s+.*$", line)
        if list_match is None:
            index += 1
            continue

        list_indent = len(list_match.group(1))
        table_lines = []
        look_ahead = index + 1

        while look_ahead < len(lines):
            next_line = lines[look_ahead]
            if not next_line.strip():
                break

            next_indent = len(next_line) - len(next_line.lstrip(" "))
            stripped = next_line.strip()
            if next_indent <= list_indent:
                break
            if not stripped.startswith("|"):
                break

            table_lines.append(next_line)
            look_ahead += 1

        if len(table_lines) >= 2:
            normalized_lines.append("")
            normalized_lines.extend(table_lines)
            index = look_ahead
            continue

        index += 1

    return "\n".join(normalized_lines)


def normalize_indented_tables(value):
    normalized = []

    for line in value.splitlines():
        if line.startswith("    |"):
            normalized.append(line[4:])
        else:
            normalized.append(line)

    return "\n".join(normalized)


def split_pipe_table_row(row):
    stripped = row.strip()
    if stripped.startswith("|"):
        stripped = stripped[1:]
    if stripped.endswith("|"):
        stripped = stripped[:-1]
    return [cell.strip() for cell in stripped.split("|")]


def is_pipe_table_header(lines, start_index):
    if start_index + 1 >= len(lines):
        return False

    header_line = lines[start_index].strip()
    separator_line = lines[start_index + 1].strip()
    return bool(header_line) and "|" in header_line and TABLE_SEPARATOR_RE.match(separator_line) is not None


def collect_pipe_table_block(lines, start_index):
    if not is_pipe_table_header(lines, start_index):
        return [], start_index

    table_lines = [lines[start_index], lines[start_index + 1]]
    cursor = start_index + 2

    while cursor < len(lines):
        candidate = lines[cursor]
        stripped = candidate.strip()
        if not stripped or "|" not in stripped:
            break

        table_lines.append(candidate)
        cursor += 1

    return table_lines, cursor


def parse_pipe_table(table_lines):
    if len(table_lines) < 2 or TABLE_SEPARATOR_RE.match(table_lines[1]) is None:
        return ""

    headers = split_pipe_table_row(table_lines[0])
    rows = [split_pipe_table_row(row) for row in table_lines[2:]]
    header_html = "".join(f"<th>{render_inline_markdown(header)}</th>" for header in headers)
    body_html = []

    for row in rows:
        padded = row + ([""] * max(0, len(headers) - len(row)))
        body_html.append("<tr>" + "".join(f"<td>{render_inline_markdown(cell)}</td>" for cell in padded[: len(headers)]) + "</tr>")

    return (
        "<table>"
        "<thead><tr>" + header_html + "</tr></thead>"
        "<tbody>" + "".join(body_html) + "</tbody>"
        "</table>"
    )
