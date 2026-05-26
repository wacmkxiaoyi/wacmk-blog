from html.parser import HTMLParser
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from apps.blog.models import Post

from .navigation import can_display_post_in_book_navigation, get_book_structure_post_ids


class _BookContentLinkRewriter(HTMLParser):
    def __init__(self, *, href_builder):
        super().__init__(convert_charrefs=False)
        self.href_builder = href_builder
        self.parts = []

    def handle_starttag(self, tag, attrs):
        self.parts.append(self.get_starttag_text() if tag.lower() != "a" else self._render_start_tag(tag, attrs, closing=False))

    def handle_startendtag(self, tag, attrs):
        self.parts.append(self.get_starttag_text() if tag.lower() != "a" else self._render_start_tag(tag, attrs, closing=True))

    def handle_endtag(self, tag):
        self.parts.append(f"</{tag}>")

    def handle_data(self, data):
        self.parts.append(data)

    def handle_entityref(self, name):
        self.parts.append(f"&{name};")

    def handle_charref(self, name):
        self.parts.append(f"&#{name};")

    def handle_comment(self, data):
        self.parts.append(f"<!--{data}-->")

    def handle_decl(self, decl):
        self.parts.append(f"<!{decl}>")

    def handle_pi(self, data):
        self.parts.append(f"<?{data}>")

    def unknown_decl(self, data):
        self.parts.append(f"<![{data}]>")

    def get_html(self):
        return "".join(self.parts)

    def _render_start_tag(self, tag, attrs, *, closing):
        rewritten_attrs = []
        for name, value in attrs:
            if name.lower() == "href" and value is not None:
                value = self.href_builder(value)
            rewritten_attrs.append((name, value))
        suffix = " /" if closing else ""
        return f"<{tag}{self._format_attrs(rewritten_attrs)}{suffix}>"

    def _format_attrs(self, attrs):
        rendered = []
        for name, value in attrs:
            if value is None:
                rendered.append(f" {name}")
                continue
            escaped = (
                str(value)
                .replace("&", "&amp;")
                .replace('"', "&quot;")
            )
            rendered.append(f' {name}="{escaped}"')
        return "".join(rendered)


def rewrite_book_content_internal_links(rendered_content, *, book, request, is_share_view=False, share_link=None):
    structure_post_ids = get_book_structure_post_ids(book.structure)
    if not rendered_content or not structure_post_ids:
        return rendered_content

    visible_posts = {
        post.slug: post
        for post in Post.objects.filter(pk__in=structure_post_ids, status=Post.STATUS_PUBLISHED)
        if can_display_post_in_book_navigation(post, request.user, is_share_view=is_share_view)
    }
    if not visible_posts:
        return rendered_content

    base_url = share_link.get_absolute_url() if is_share_view and share_link is not None else book.get_absolute_url()

    def rewrite_href(href):
        parsed = urlsplit(href or "")
        if parsed.scheme or parsed.netloc or not parsed.path:
            return href
        if not parsed.path.startswith("/blog/"):
            return href
        slug = parsed.path.strip("/").split("/")[-1]
        if not slug or slug not in visible_posts:
            return href

        query_pairs = [(key, value) for key, value in parse_qsl(parsed.query, keep_blank_values=True) if key != "post"]
        query_pairs.append(("post", slug))
        return urlunsplit(("", "", base_url, urlencode(query_pairs), parsed.fragment))

    parser = _BookContentLinkRewriter(href_builder=rewrite_href)
    parser.feed(rendered_content)
    parser.close()
    return parser.get_html()


__all__ = ["rewrite_book_content_internal_links"]
