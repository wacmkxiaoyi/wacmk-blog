import re

import markdown as markdown_lib
from pygments.formatters.html import HtmlFormatter


ALLOWED_MARKDOWN_TAGS = [
    "a", "abbr", "acronym", "b", "blockquote", "code", "div", "em", "i", "li", "ol", "strong", "ul",
    "p", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "table", "thead", "tbody", "tr", "th", "td",
    "img", "hr", "br", "details", "summary", "button", "section", "span", "video", "source",
]
ALLOWED_MARKDOWN_ATTRIBUTES = {
    "a": ["href", "title", "target", "rel"],
    "img": ["src", "alt", "title"],
    "video": ["src", "controls", "preload", "poster", "width", "height"],
    "source": ["src", "type"],
    "th": ["align"],
    "td": ["align"],
    "blockquote": ["class"],
    "div": ["class"],
    "p": ["class"],
    "span": ["class"],
    "details": ["class", "open"],
    "summary": ["class"],
    "button": ["class", "type", "data-tab-target", "data-tab-group", "aria-selected"],
    "section": ["class", "data-tab-panel", "data-tab-group", "hidden"],
}
ALLOWED_MARKDOWN_CLASSES_BY_TAG = {
    "blockquote": {
        "markdown-callout",
        "markdown-callout-note",
        "markdown-callout-tip",
        "markdown-callout-important",
        "markdown-callout-caution",
        "markdown-callout-warning",
    },
    "div": {
        "codehilite",
        "markdown-tabs",
        "markdown-tabs-nav",
        "markdown-tabs-panels",
        "markdown-admonition-body",
    },
    "p": {"markdown-callout-title"},
    "span": {
        "md-color-berry",
        "md-color-rose",
        "md-color-orange",
        "md-color-gold",
        "md-color-green",
        "md-color-cyan",
        "md-color-blue",
        "md-color-purple",
    },
    "details": {
        "markdown-admonition",
        "markdown-admonition-note",
        "markdown-admonition-tip",
        "markdown-admonition-warning",
    },
    "summary": {"markdown-admonition-summary"},
    "button": {"markdown-tab-button", "is-active"},
    "section": {"markdown-tab-panel", "is-active"},
}

ALLOWED_MARKDOWN_CLASSES_BY_TAG["span"].update(set(HtmlFormatter().class2style.keys()) | {"hll"})

COLOR_ATTRIBUTE_RE = re.compile(
    r"\[(?P<text>(?:[^\[\]\\]|\\.|\[(?:[^\[\]\\]|\\.)*\])+)]\{\.(?P<class_name>md-color-(?:berry|rose|orange|gold|green|cyan|blue|purple))\}"
)


def normalize_colored_spans(value):
    def replace_match(match):
        text = match.group("text")
        class_name = match.group("class_name")
        return f'<span class="{class_name}">{text}</span>'

    previous = None
    current = value or ""

    while current != previous:
        previous = current
        current = COLOR_ATTRIBUTE_RE.sub(replace_match, current)

    return current


def render_markdown_html(value):
    return markdown_lib.markdown(
        normalize_colored_spans(value),
        extensions=["extra", "fenced_code", "tables", "toc", "codehilite"],
        extension_configs={
            "codehilite": {
                "guess_lang": False,
                "css_class": "codehilite",
                "use_pygments": True,
                "noclasses": False,
            }
        },
        output_format="html5",
    )


def render_inline_markdown(value):
    rendered = render_markdown_html(value or "")
    if rendered.startswith("<p>") and rendered.endswith("</p>"):
        return rendered[3:-4]
    return rendered
