from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.dashboard.models import ContentViewLog
from apps.resources.models import Article, Attachment, Book, MediaAsset
from apps.site_settings.models import SiteSetting
from apps.tags.models import Tag
from apps.users.models import User


class HomeDashboardTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(
            username="author", email="author@example.com", password="password123"
        )
        self.reader = User.objects.create_user(
            username="reader", email="reader@example.com", password="password123"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.reader)

    def test_authorized_view_records_one_view_within_cooldown(self):
        article = Article.objects.create(
            author=self.author, title="Published", slug="published"
        )

        self.assertEqual(self.client.post(f"/api/resources/articles/{article.slug}/view/").status_code, 204)
        self.assertEqual(self.client.post(f"/api/resources/articles/{article.slug}/view/").status_code, 204)
        article.refresh_from_db()

        self.assertEqual(article.view_count, 1)
        self.assertEqual(ContentViewLog.objects.count(), 1)
        self.assertEqual(ContentViewLog.objects.get().user, self.reader)

    def test_denied_view_does_not_record_a_view(self):
        article = Article.objects.create(
            author=self.author,
            title="Restricted",
            slug="restricted",
            visibility="conditional",
            condition_rules=[{"type": "points", "value": 100}],
        )

        self.assertEqual(self.client.post(f"/api/resources/articles/{article.slug}/view/").status_code, 204)
        article.refresh_from_db()
        self.assertEqual(article.view_count, 0)
        self.assertFalse(ContentViewLog.objects.exists())

    def test_book_article_view_counts_article_and_book_once_within_cooldown(self):
        article = Article.objects.create(
            author=self.author, title="Chapter", slug="chapter"
        )
        book = Book.objects.create(
            created_by=self.author,
            name="Guide",
            slug="guide",
            structure=[{"type": "article", "article_id": article.pk}],
        )

        url = f"/api/resources/articles/{article.slug}/view/"
        self.assertEqual(self.client.post(url, {"bookId": book.pk}, format="json").status_code, 204)
        self.assertEqual(self.client.post(url, {"bookId": book.pk}, format="json").status_code, 204)
        article.refresh_from_db()
        book.refresh_from_db()

        self.assertEqual(article.view_count, 1)
        self.assertEqual(book.view_count, 1)
        self.assertEqual(ContentViewLog.objects.count(), 2)

    def test_invalid_book_context_does_not_record_a_view(self):
        article = Article.objects.create(
            author=self.author, title="Chapter", slug="chapter"
        )
        book = Book.objects.create(
            created_by=self.author, name="Other guide", slug="other-guide"
        )

        response = self.client.post(
            f"/api/resources/articles/{article.slug}/view/",
            {"bookId": book.pk},
            format="json",
        )
        article.refresh_from_db()
        book.refresh_from_db()

        self.assertEqual(response.status_code, 204)
        self.assertEqual(article.view_count, 0)
        self.assertEqual(book.view_count, 0)
        self.assertFalse(ContentViewLog.objects.exists())

    def test_missing_article_view_is_ignored(self):
        self.assertEqual(
            self.client.post("/api/resources/articles/missing-draft/view/").status_code,
            204,
        )
        self.assertFalse(ContentViewLog.objects.exists())

    def test_dashboard_uses_discoverable_content_and_fills_missing_days(self):
        tag = Tag.objects.create(name="Guides")
        article = Article.objects.create(
            author=self.author, title="Public", slug="public"
        )
        article.tags.add(tag)
        private_article = Article.objects.create(
            author=self.author,
            title="Private",
            slug="private",
            visibility="private",
        )
        book = Book.objects.create(created_by=self.author, name="Guide", slug="guide")
        asset = MediaAsset.objects.create(
            kind="attachment", file="test.txt", original_filename="test.txt", uploaded_by=self.author
        )
        Attachment.objects.create(
            title="Notes", asset=asset, original_filename="test.txt", uploaded_by=self.author
        )
        ContentViewLog.objects.create(
            resource_type="article", resource_id=article.pk, user=self.reader, visitor_key="reader"
        )
        ContentViewLog.objects.create(
            resource_type="article", resource_id=private_article.pk, user=self.reader, visitor_key="private"
        )
        ContentViewLog.objects.create(
            resource_type="book", resource_id=book.pk, user=self.reader, visitor_key="book"
        )
        SiteSetting.objects.create(
            key="basic.site", value={"title": "Example", "dashboard_visit_trend_days": 7}
        )

        response = self.client.get("/api/dashboard/home/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["stats"], {"articles": 1, "tags": 1, "books": 1, "attachments": 1, "authors": 1})
        self.assertEqual(response.data["visits"], {"articles": 1, "books": 1, "days": 7})
        self.assertEqual(len(response.data["trend"]), 7)
        self.assertEqual(response.data["trend"][-1]["date"], timezone.localdate().isoformat())

    def test_dashboard_requires_authentication(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/dashboard/home/").status_code, 401)
