import importlib

from django.test import SimpleTestCase, override_settings
from django.urls import clear_url_caches


PLAYGROUND_URLS = (
    "/test/frontend/packages/modal",
    "/test/frontend/packages/context-actions",
    "/test/frontend/packages/content-renderer",
    "/test/frontend/packages/table",
    "/test/frontend/packages/editor",
    "/test/frontend/packages/catalog-manager",
    "/test/frontend/packages/card",
    "/test/frontend/packages/tooltip",
)


class PlaygroundUrlTests(SimpleTestCase):
    def reload_urlconf(self):
        import config.urls

        importlib.reload(config.urls)
        clear_url_caches()

    def test_playground_urls_are_available_when_debug_is_enabled(self):
        with override_settings(DEBUG=True):
            self.reload_urlconf()
            for url in PLAYGROUND_URLS:
                with self.subTest(url=url):
                    self.assertEqual(self.client.get(url).status_code, 204)

        self.reload_urlconf()

    def test_playground_urls_return_404_when_debug_is_disabled(self):
        with override_settings(DEBUG=False):
            self.reload_urlconf()
            for url in PLAYGROUND_URLS:
                with self.subTest(url=url):
                    self.assertEqual(self.client.get(url).status_code, 404)

        self.reload_urlconf()
