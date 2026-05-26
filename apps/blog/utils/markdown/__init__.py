from .blocks import render_markdown_blocks
from .render import ALLOWED_MARKDOWN_ATTRIBUTES, ALLOWED_MARKDOWN_CLASSES_BY_TAG, ALLOWED_MARKDOWN_TAGS

import bleach


def render_markdown(value):
    rendered = render_markdown_blocks(value)

    def filter_markdown_attributes(tag, name, value):
        allowed_attributes = ALLOWED_MARKDOWN_ATTRIBUTES.get(tag, [])

        if name not in allowed_attributes:
            return False
        if name != "class":
            return True

        allowed_classes = ALLOWED_MARKDOWN_CLASSES_BY_TAG.get(tag, set())
        class_names = [class_name for class_name in value.split() if class_name in allowed_classes]
        return " ".join(class_names) if class_names else False

    return bleach.clean(rendered, tags=ALLOWED_MARKDOWN_TAGS, attributes=filter_markdown_attributes, strip=True)


__all__ = ["render_markdown"]
