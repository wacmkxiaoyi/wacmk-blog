from django.test import SimpleTestCase

from apps.blog.utils.markdown import render_markdown


class MarkdownRenderingTests(SimpleTestCase):
    def test_loose_blocks_after_blockquote_render_as_separate_blocks(self):
        content = "\n".join([
            "> 111",
            "[test post (Copy)](/blog/test-post-copy/)",
            '<span class="md-color-berry">123</span>',
            "***123***",
            "[test post](/blog/test-post/)",
        ])

        rendered = render_markdown(content)

        self.assertIn("<blockquote>", rendered)
        self.assertIn("<p>111</p>", rendered)
        self.assertIn('<p><a href="/blog/test-post-copy/">test post (Copy)</a></p>', rendered)
        self.assertIn('<p><span class="md-color-berry">123</span></p>', rendered)
        self.assertIn("<p><strong><em>123</em></strong></p>", rendered)
        self.assertIn('<p><a href="/blog/test-post/">test post</a></p>', rendered)

    def test_fenced_code_blocks_with_language_render_as_code_block(self):
        content = "\n".join([
            "```js",
            "EMAIL_SERVER_PROVIDER = { GENERAL: 'general_email_provider', GMAIL: 'Gmail', MICROSOFT: 'Microsoft' }",
            "```",
        ])

        rendered = render_markdown(content)

        self.assertIn('class="codehilite"', rendered)
        self.assertIn("<pre>", rendered)
        self.assertIn("<code>", rendered)
        self.assertIn("EMAIL_SERVER_PROVIDER", rendered)
