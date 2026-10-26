from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.files.storage import default_storage
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from django.contrib.auth.models import Group
from django.contrib.auth.hashers import make_password
from unittest.mock import patch

from apps.resources.models import Article, ArticleDraft, Attachment, Book, MediaAsset, MediaAssetReference
from apps.resources.external_links import rotate_book_external_link, rotate_external_link
from apps.resources.serializers import list_article_ids
from apps.resources.access.infrastructure.repositories import ResourceRepository
from apps.site_settings.models import SiteSetting
from apps.tags.models import Tag
from apps.users.models import User


@override_settings(MEDIA_ROOT="/tmp/wacmk-content-tests")
class ContentApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="author", email="author@example.com", password="password123")
        self.other = User.objects.create_user(username="reader", email="reader@example.com", password="password123")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_resource_models_are_registered(self):
        self.assertEqual(ResourceRepository.RESOURCE_MODEL_MAP["article"], "resources.Article")
        self.assertEqual(ResourceRepository.RESOURCE_MODEL_MAP["book"], "resources.Book")
        self.assertEqual(ResourceRepository.RESOURCE_MODEL_MAP["attachment"], "resources.Attachment")

    def test_article_create_and_reference_search(self):
        response = self.client.post("/api/resources/articles/", {"title": "Renderer template", "content": "# Content", "suppress_detail_hero": True}, format="json")
        self.assertEqual(response.status_code, 201)
        article = Article.objects.get()
        self.assertIsNotNone(article.published_at)
        self.assertTrue(article.suppress_detail_hero)
        self.assertTrue(response.data["suppress_detail_hero"])
        response = self.client.patch(f"/api/resources/articles/{article.slug}/", {"suppress_detail_hero": False}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["suppress_detail_hero"])
        article.refresh_from_db()
        self.assertFalse(article.suppress_detail_hero)
        response = self.client.get("/api/resources/articles/?query=renderer")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["items"][0]["slug"], article.slug)

    def test_article_create_does_not_read_back_from_zincsearch(self):
        with patch("apps.resources.serializers.index_article"), patch(
            "apps.resources.serializers.get_article_document",
            side_effect=RuntimeError("document is not searchable yet"),
        ):
            response = self.client.post(
                "/api/resources/articles/",
                {"title": "New article", "abstract": "New abstract", "content": "New content"},
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["abstract"], "New abstract")
        self.assertEqual(response.data["content"], "New content")

    def test_my_article_list_is_owner_scoped_and_separates_drafts(self):
        own_article = Article.objects.create(author=self.user, title="My article", slug="my-article")
        Article.objects.create(author=self.other, title="Other article", slug="other-article")
        own_draft = ArticleDraft.objects.create(article_id=100, author=self.user, title="My draft", slug="my-draft")
        revision = ArticleDraft.objects.create(article_id=own_article.pk, author=self.user, title="My revision", slug="my-revision")

        published = self.client.get("/api/resources/articles/mine/?kinds=published&page_size=1")
        drafts = self.client.get("/api/resources/articles/mine/?kinds=draft&kinds=revision")

        self.assertEqual(published.status_code, 200)
        self.assertEqual(published.data["total"], 1)
        self.assertEqual(published.data["items"][0]["slug"], own_article.slug)
        self.assertEqual(drafts.status_code, 200)
        self.assertEqual({item["slug"] for item in drafts.data["items"]}, {own_draft.slug, revision.slug})

    def test_my_article_search_uses_only_title_and_slug(self):
        article = Article.objects.create(
            author=self.user,
            title="Searchable title",
            slug="searchable-slug",
            summary="summary-only-match",
            content="content-only-match",
        )
        article.tags.add(Tag.objects.create(name="tag-only-match"))

        self.assertEqual(self.client.get("/api/resources/articles/mine/?query=searchable").data["total"], 1)
        self.assertEqual(self.client.get("/api/resources/articles/mine/?query=summary-only-match").data["total"], 0)
        self.assertEqual(self.client.get("/api/resources/articles/mine/?query=content-only-match").data["total"], 0)
        self.assertEqual(self.client.get("/api/resources/articles/mine/?query=tag-only-match").data["total"], 0)

    def test_my_article_external_links_are_owner_scoped(self):
        own_article = Article.objects.create(author=self.user, title="Public", slug="public")
        other_article = Article.objects.create(author=self.other, title="Other", slug="other")

        created = self.client.post(f"/api/resources/article-external-links/mine/{own_article.pk}/", {"expiry": "7d"}, format="json")
        self.assertEqual(created.status_code, 200)
        self.assertTrue(created.data["url"])
        self.assertEqual(self.client.get("/api/resources/article-external-links/mine/").data["total"], 1)
        self.assertEqual(self.client.post(f"/api/resources/article-external-links/mine/{other_article.pk}/", {"expiry": "7d"}, format="json").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/resources/article-external-links/mine/{own_article.pk}/").status_code, 204)

    def test_article_write_policy_restricts_non_admin_but_not_deletion(self):
        article = Article.objects.create(author=self.user, title="Existing", slug="existing")
        SiteSetting.objects.create(key="content.article", value={
            "allow_non_admin_create": False,
            "non_admin_max_count": 10,
            "vip_only": False,
            "editor_autosave_enabled": True,
            "editor_autosave_interval_minutes": 5,
            "author_reward_money_ratio": "0.80",
            "author_reward_points_ratio": "0.00",
        })
        cache.clear()

        self.assertEqual(self.client.post("/api/resources/drafts/", {"title": "Blocked"}, format="json").status_code, 403)
        self.assertEqual(self.client.patch(f"/api/resources/articles/{article.slug}/", {"title": "Blocked"}, format="json").status_code, 403)
        self.assertEqual(self.client.delete(f"/api/resources/articles/{article.slug}/").status_code, 204)

        manager = User.objects.create_user(username="manager", email="manager@example.com", password="password123", is_staff=True)
        self.client.force_authenticate(manager)
        self.assertEqual(self.client.post("/api/resources/drafts/", {"title": "Allowed"}, format="json").status_code, 201)

    def test_article_write_policy_enforces_non_admin_limit(self):
        SiteSetting.objects.create(key="content.article", value={
            "allow_non_admin_create": True,
            "non_admin_max_count": 1,
            "vip_only": False,
            "editor_autosave_enabled": True,
            "editor_autosave_interval_minutes": 5,
            "author_reward_money_ratio": "0.80",
            "author_reward_points_ratio": "0.00",
        })
        cache.clear()
        Article.objects.create(author=self.user, title="First", slug="first")

        self.assertEqual(self.client.post("/api/resources/drafts/", {"title": "Over limit"}, format="json").status_code, 403)
        self.assertEqual(self.client.post("/api/resources/articles/", {"title": "Over limit"}, format="json").status_code, 403)

    def test_book_write_policy_restricts_existing_book_updates_but_not_deletion(self):
        article = Article.objects.create(author=self.user, title="Chapter", slug="chapter")
        book = Book.objects.create(created_by=self.user, name="Existing book", slug="existing-book", structure=[{"type": "article", "article_id": article.pk}])
        SiteSetting.objects.create(key="content.book", value={
            "allow_non_admin_create": False,
            "non_admin_max_count": 3,
            "vip_only": False,
            "author_reward_money_ratio": "0.80",
            "author_reward_points_ratio": "0.00",
        })
        cache.clear()

        self.assertEqual(self.client.patch(f"/api/resources/books/{book.slug}/", {"summary": "Blocked"}, format="json").status_code, 403)
        self.assertEqual(self.client.delete(f"/api/resources/books/{book.slug}/").status_code, 204)
        self.assertTrue(Article.objects.filter(pk=article.pk).exists())

    def test_book_write_policy_enforces_limit_on_creates_and_updates(self):
        article = Article.objects.create(author=self.user, title="Chapter", slug="book-chapter")
        book = Book.objects.create(created_by=self.user, name="Existing book", slug="limited-book", structure=[{"type": "article", "article_id": article.pk}])
        SiteSetting.objects.create(key="content.book", value={
            "allow_non_admin_create": True,
            "non_admin_max_count": 1,
            "vip_only": False,
            "author_reward_money_ratio": "0.80",
            "author_reward_points_ratio": "0.00",
        })
        cache.clear()
        payload = {"name": "Another book", "structure": [{"type": "article", "article_id": article.pk}]}

        self.assertEqual(self.client.post("/api/resources/books/", payload, format="json").status_code, 403)
        self.assertEqual(self.client.patch(f"/api/resources/books/{book.slug}/", {"summary": "Blocked"}, format="json").status_code, 403)

        manager = User.objects.create_user(username="book-manager", email="book-manager@example.com", password="password123", is_staff=True)
        self.client.force_authenticate(manager)
        self.assertEqual(self.client.patch(f"/api/resources/books/{book.slug}/", {"summary": "Allowed"}, format="json").status_code, 200)

    def test_my_book_list_and_external_links_are_owner_scoped(self):
        article = Article.objects.create(author=self.user, title="Chapter", slug="owned-chapter")
        own_book = Book.objects.create(created_by=self.user, name="My book", slug="my-book", structure=[{"type": "article", "article_id": article.pk}])
        other_article = Article.objects.create(author=self.other, title="Other chapter", slug="other-chapter")
        other_book = Book.objects.create(created_by=self.other, name="Other book", slug="other-book", structure=[{"type": "article", "article_id": other_article.pk}])

        listed = self.client.get("/api/resources/books/mine/")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual([item["slug"] for item in listed.data["items"]], [own_book.slug])
        self.assertEqual(self.client.post(f"/api/resources/book-external-links/mine/{other_book.pk}/", {"expiry": "7d"}, format="json").status_code, 404)
        created = self.client.post(f"/api/resources/book-external-links/mine/{own_book.pk}/", {"expiry": "7d"}, format="json")
        self.assertEqual(created.status_code, 200)
        self.assertTrue(created.data["url"])

    def test_article_reuse_permissions_survive_revision_and_publish(self):
        article = Article.objects.create(author=self.user, title="Reusable", slug="reusable", allow_quote=False, allow_reprint=True)

        revision = self.client.post(f"/api/resources/articles/{article.slug}/revision/")

        self.assertEqual(revision.status_code, 201)
        self.assertFalse(revision.data["allow_quote"])
        self.assertTrue(revision.data["allow_reprint"])
        published = self.client.post(f"/api/resources/drafts/{revision.data['slug']}/publish/")
        self.assertEqual(published.status_code, 200)
        self.assertFalse(published.data["allow_quote"])
        self.assertTrue(published.data["allow_reprint"])

    def test_reuse_candidates_and_import_enforce_consent_and_access(self):
        reusable = Article.objects.create(
            author=self.user,
            title="Reusable", slug="reusable", summary="Source summary", content="Source content",
            allow_quote=True, allow_reprint=True, visibility="conditional", condition_rules=[{"type": "book_only"}],
        )
        reusable.tags.add(Tag.objects.create(name="Reusable tag"))
        Article.objects.create(author=self.user, title="No quote", slug="no-quote", allow_quote=False, allow_reprint=True)
        Article.objects.create(author=self.user, title="No reprint", slug="no-reprint", allow_quote=True, allow_reprint=False)
        Article.objects.create(author=self.user, title="Private", slug="private-reuse", visibility="private", allow_quote=True, allow_reprint=True)
        self.client.force_authenticate(self.other)

        references = self.client.get("/api/resources/articles/reference-candidates/")
        imports = self.client.get("/api/resources/articles/import-candidates/")

        self.assertEqual(references.status_code, 200)
        self.assertEqual({item["slug"] for item in references.data["items"]}, {"reusable", "no-reprint"})
        self.assertEqual(imports.status_code, 200)
        self.assertEqual({item["slug"] for item in imports.data["items"]}, {"reusable", "no-quote"})
        response = self.client.post("/api/resources/articles/import/", {"article_id": reusable.pk}, format="json")
        self.assertEqual(response.status_code, 201)
        draft = ArticleDraft.objects.get(pk=response.data["id"])
        self.assertEqual(draft.author, self.other)
        self.assertEqual(draft.title, "Reusable (Copy)")
        self.assertEqual(draft.content, reusable.content)
        self.assertEqual(draft.condition_rules, reusable.condition_rules)
        self.assertEqual(list(draft.tags.values_list("name", flat=True)), ["Reusable tag"])
        self.assertTrue(draft.allow_quote)
        self.assertTrue(draft.allow_reprint)
        denied = Article.objects.get(slug="no-reprint")
        self.assertEqual(self.client.post("/api/resources/articles/import/", {"article_id": denied.pk}, format="json").status_code, 403)

    def test_article_author_and_manager_bypass_reuse_consent(self):
        article = Article.objects.create(author=self.user, title="Restricted reuse", slug="restricted-reuse", allow_quote=False, allow_reprint=False)
        self.client.force_authenticate(self.user)

        self.assertEqual(self.client.get("/api/resources/articles/reference-candidates/").data["items"][0]["slug"], article.slug)
        self.assertEqual(self.client.get("/api/resources/articles/import-candidates/").data["items"][0]["slug"], article.slug)
        self.assertEqual(self.client.post("/api/resources/articles/import/", {"article_id": article.pk}, format="json").status_code, 201)

    def test_import_copies_inline_media_and_reuses_independent_attachments(self):
        image_upload = self.client.post(
            "/api/resources/media/image/",
            {"image": SimpleUploadedFile("source.png", b"source image", content_type="image/png")},
            format="multipart",
        )
        source_image = MediaAsset.objects.get(pk=image_upload.data["assetId"])
        attachment_upload = self.client.post(
            "/api/resources/attachments/",
            {"title": "Source attachment", "file": SimpleUploadedFile("source.txt", b"source attachment")},
            format="multipart",
        )
        source_attachment = Attachment.objects.get(pk=attachment_upload.data["id"])
        content = f'::image{{assetId="{source_image.pk}"}}\n::custom{{kind="attachment" attachmentId="{source_attachment.pk}" assetId="{source_attachment.asset_id}" title="Source attachment"}}'
        source = self.client.post(
            "/api/resources/articles/",
            {"title": "Media source", "content": content, "allow_reprint": True},
            format="json",
        )
        article = Article.objects.get(pk=source.data["id"])
        source_image.refresh_from_db()
        source_image_name = source_image.file.name
        article.cover_image = SimpleUploadedFile("cover.gif", b"GIF87a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;", content_type="image/gif")
        article.save()
        source_cover_name = article.cover_image.name
        self.client.force_authenticate(self.other)

        imported = self.client.post("/api/resources/articles/import/", {"article_id": article.pk}, format="json")

        self.assertEqual(imported.status_code, 201)
        draft = ArticleDraft.objects.get(pk=imported.data["id"])
        copied_image_id = next(asset_id for asset_id in self._asset_ids(draft.content) if asset_id != str(source_image.pk))
        copied_image = MediaAsset.objects.get(pk=copied_image_id)
        self.assertNotEqual(copied_image.file.name, source_image_name)
        self.assertTrue(default_storage.exists(copied_image.file.name))
        self.assertNotEqual(draft.cover_image.name, source_cover_name)
        self.assertTrue(default_storage.exists(draft.cover_image.name))
        self.assertIn(str(source_attachment.asset_id), draft.content)
        self.assertIn(f'attachmentId="{source_attachment.pk}"', draft.content)
        self.assertTrue(MediaAssetReference.objects.filter(asset=copied_image, resource_type="article", resource_id=draft.article_id).exists())
        self.assertTrue(MediaAssetReference.objects.filter(asset=source_attachment.asset, resource_type="article", resource_id=draft.article_id).exists())
        manifest = self.client.post(
            f"/api/resources/drafts/{draft.slug}/asset-manifest/",
            {"assetIds": [str(copied_image.pk), str(source_attachment.asset_id)], "attachmentIds": [source_attachment.pk]},
            format="json",
        )
        self.assertEqual(manifest.status_code, 200)
        self.assertIn(str(copied_image.pk), manifest.data["assets"])
        self.assertIn(str(source_attachment.asset_id), manifest.data["assets"])
        self.assertEqual(manifest.data["assets"][str(source_attachment.asset_id)]["attachmentId"], source_attachment.pk)

    @staticmethod
    def _asset_ids(content):
        import re

        return re.findall(r'assetId="([0-9a-fA-F-]{36})"', content)

        manager = User.objects.create_user(username="reuse-manager", email="reuse-manager@example.com", password="password123", is_staff=True)
        self.client.force_authenticate(manager)
        self.assertEqual(self.client.get("/api/resources/articles/reference-candidates/").data["items"][0]["slug"], article.slug)
        self.assertEqual(self.client.get("/api/resources/articles/import-candidates/").data["items"][0]["slug"], article.slug)
        self.assertEqual(self.client.post("/api/resources/articles/import/", {"article_id": article.pk}, format="json").status_code, 201)

    def test_non_latin_title_uses_a_stable_fallback_slug(self):
        response = self.client.post("/api/resources/drafts/", {"title": "未命名文章"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["slug"], f"article-{response.data['article_id']}")

    def test_new_draft_can_start_without_a_title(self):
        response = self.client.post("/api/resources/drafts/", {"title": ""}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["title"], "")
        self.assertEqual(response.data["slug"], f"article-{response.data['article_id']}")

    def test_article_draft_accepts_comma_separated_tag_names(self):
        response = self.client.post(
            "/api/resources/drafts/",
            {"title": "Tagged", "tag_names": "Django, React, Django,  "},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual([tag["name"] for tag in response.data["tags"]], ["Django", "React"])

    def test_article_draft_slug_can_be_updated_or_regenerated(self):
        created = self.client.post("/api/resources/drafts/", {"title": "Slug draft"}, format="json")
        response = self.client.patch(f"/api/resources/drafts/{created.data['slug']}/", {"slug": "chosen-slug"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["slug"], "chosen-slug")
        response = self.client.patch("/api/resources/drafts/chosen-slug/", {"slug": ""}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["slug"], "slug-draft")

    def test_private_article_is_not_listed_to_other_user(self):
        Article.objects.create(author=self.user, title="Private", slug="private", visibility="private")
        self.client.force_authenticate(self.other)
        response = self.client.get("/api/resources/articles/")
        self.assertEqual(response.data["total"], 0)

    def test_article_detail_includes_the_viewer_interaction(self):
        article = Article.objects.create(author=self.user, title="Article", slug="article")
        self.client.put(f"/api/resources/articles/{article.slug}/star/", {"starred": True}, format="json")
        self.client.put(f"/api/resources/articles/{article.slug}/vote/", {"vote": "up"}, format="json")

        response = self.client.get(f"/api/resources/articles/{article.slug}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["interaction"]["isStarred"], True)
        self.assertEqual(response.data["interaction"]["currentVote"], "up")
        self.assertEqual(response.data["interaction"]["upCount"], 1)

    def test_draft_detail_is_hidden_from_non_owner(self):
        draft = ArticleDraft.objects.create(article_id=1000, author=self.user, title="Draft", slug="draft", visibility="public")
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f"/api/resources/drafts/{draft.slug}/").status_code, 404)

    def test_managed_article_list_filters_by_kinds_and_hides_content(self):
        staff = User.objects.create_user(username="staff", email="staff@example.com", password="password123", is_staff=True)
        draft = ArticleDraft.objects.create(article_id=1001, author=self.user, title="Draft guide", slug="draft-guide", content="private body")
        article = Article.objects.create(author=self.other, title="Published guide", slug="published-guide")
        revision = ArticleDraft.objects.create(article_id=article.pk, author=self.other, title="Revision guide", slug="revision-guide", content="private revision")
        self.client.force_authenticate(staff)

        response = self.client.get("/api/manage/articles/", {"kinds": ["draft"], "query": "guide", "ordering": "title", "page_size": 1})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 1)
        self.assertEqual(response.data["items"][0]["slug"], draft.slug)
        self.assertNotIn("content", response.data["items"][0])

        response = self.client.get("/api/manage/articles/", {"kinds": ["revision"]})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 1)
        self.assertEqual(response.data["items"][0]["slug"], revision.slug)
        self.assertEqual(response.data["items"][0]["kind"], "revision")

        response = self.client.get("/api/manage/articles/", {"kinds": ["draft", "revision"], "ordering": "title"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 2)
        self.assertEqual(
            [(item["slug"], item["kind"]) for item in response.data["items"]],
            [(draft.slug, "draft"), (revision.slug, "revision")],
        )
        self.assertNotIn("content", response.data["items"][0])

    def test_managed_article_search_excludes_summary_content_and_tags(self):
        staff = User.objects.create_user(username="staff", email="staff@example.com", password="password123", is_staff=True)
        article = Article.objects.create(
            author=self.user,
            title="Managed title",
            slug="managed-slug",
            summary="managed-summary-only",
            content="managed-content-only",
        )
        article.tags.add(Tag.objects.create(name="managed-tag-only"))
        self.client.force_authenticate(staff)

        self.assertEqual(self.client.get("/api/manage/articles/?query=managed").data["total"], 1)
        self.assertEqual(self.client.get("/api/manage/articles/?query=author").data["total"], 1)
        self.assertEqual(self.client.get("/api/manage/articles/?query=managed-summary-only").data["total"], 0)
        self.assertEqual(self.client.get("/api/manage/articles/?query=managed-content-only").data["total"], 0)
        self.assertEqual(self.client.get("/api/manage/articles/?query=managed-tag-only").data["total"], 0)

    def test_managed_article_list_defaults_to_published_and_rejects_invalid_kinds(self):
        staff = User.objects.create_user(username="staff", email="staff@example.com", password="password123", is_staff=True)
        Article.objects.create(
            author=self.user,
            title="Published",
            slug="published",
            visibility="conditional",
            condition_rules=[{"type": "points", "value": 20}],
            access_scope="standalone",
            vip_access_permission="conditional",
            vip_condition_rules=[{"type": "membership", "value": "gold"}],
        )
        self.client.force_authenticate(staff)

        response = self.client.get("/api/manage/articles/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 1)
        self.assertEqual(response.data["items"][0]["kind"], "published")
        self.assertEqual(response.data["items"][0]["condition_rules"], [{"type": "points", "value": 20}])
        self.assertEqual(response.data["items"][0]["access_scope"], "standalone")
        self.assertEqual(response.data["items"][0]["vip_access_permission"], "conditional")
        self.assertEqual(response.data["items"][0]["vip_condition_rules"], [{"type": "membership", "value": "gold"}])
        self.assertNotIn("content", response.data["items"][0])
        self.assertEqual(self.client.get("/api/manage/articles/", {"kinds": ["unknown"]}).status_code, 400)
        self.assertEqual(self.client.get("/api/manage/articles/", {"kinds": ["published", "draft"]}).status_code, 400)

    def test_managed_article_list_requires_site_manager(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get("/api/manage/articles/").status_code, 403)

    def test_managed_article_tag_cleanup_deletes_only_unreferenced_tags(self):
        staff = User.objects.create_user(username="staff-tags", email="staff-tags@example.com", password="password123", is_staff=True)
        unused = Tag.objects.create(name="Unused")
        article_tag = Tag.objects.create(name="Article tag")
        draft_tag = Tag.objects.create(name="Draft tag")
        shared_tag = Tag.objects.create(name="Shared tag")
        article = Article.objects.create(author=self.user, title="Tagged article", slug="tagged-article")
        draft = ArticleDraft.objects.create(article_id=1002, author=self.user, title="Tagged draft", slug="tagged-draft")
        article.tags.add(article_tag, shared_tag)
        draft.tags.add(draft_tag, shared_tag)
        self.client.force_authenticate(staff)

        response = self.client.post("/api/manage/articles/tags/cleanup/", format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["deleted_count"], 1)
        self.assertFalse(Tag.objects.filter(pk=unused.pk).exists())
        self.assertEqual(Tag.objects.filter(pk__in=[article_tag.pk, draft_tag.pk, shared_tag.pk]).count(), 3)

    def test_managed_article_tag_cleanup_requires_site_manager(self):
        self.client.force_authenticate(self.other)

        self.assertEqual(self.client.post("/api/manage/articles/tags/cleanup/", format="json").status_code, 403)

    def test_external_link_is_public_and_invalidated_by_access_change(self):
        article = Article.objects.create(author=self.user, title="Shared", slug="shared")
        rotate_external_link(article, "7d")
        article.save()
        token = article.external_link_token
        public_client = APIClient()

        response = public_client.get(f"/api/resources/external-links/articles/{token}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["slug"], article.slug)
        self.assertEqual(public_client.get(f"/api/resources/external-links/articles/{article.external_link_token}/comments/").status_code, 200)
        self.client.patch(f"/api/resources/articles/{article.slug}/", {"visibility": "private"}, format="json")
        article.refresh_from_db()
        self.assertIsNone(article.external_link_token)
        self.assertEqual(public_client.get(f"/api/resources/external-links/articles/{token}/").status_code, 404)

    def test_external_link_management_rotates_and_removes_token(self):
        staff = User.objects.create_user(username="staff-external", email="staff-external@example.com", password="password123", is_staff=True)
        article = Article.objects.create(author=self.user, title="Managed", slug="managed")
        self.client.force_authenticate(staff)

        response = self.client.post(f"/api/manage/article-external-links/{article.pk}/", {"expiry": "1d"}, format="json")

        self.assertEqual(response.status_code, 200)
        first_token = response.data["token"]
        self.assertTrue(first_token)
        self.assertEqual(response.data["url"], f"/external-link/articles/{first_token}")
        self.assertEqual(self.client.get("/api/manage/article-external-links/").data["items"][0]["url"], response.data["url"])
        response = self.client.patch(f"/api/manage/article-external-links/{article.pk}/", {"expiry": "30d"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["token"], first_token)
        response = self.client.post(f"/api/manage/article-external-links/{article.pk}/", {"expiry": "never"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.data["token"], first_token)
        self.assertEqual(self.client.get("/api/manage/article-external-links/").data["total"], 1)
        self.assertEqual(self.client.delete(f"/api/manage/article-external-links/{article.pk}/").status_code, 204)
        article.refresh_from_db()
        self.assertIsNone(article.external_link_token)

    def test_external_article_link_password_can_be_verified_and_cleared(self):
        article = Article.objects.create(author=self.user, title="Protected", slug="protected")

        response = self.client.post(
            f"/api/resources/article-external-links/mine/{article.pk}/",
            {"expiry": "7d", "external_link_password": "secret"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["passwordProtected"])
        self.assertEqual(response.data["externalLinkPassword"], "secret")
        token = response.data["token"]
        public_client = APIClient()
        self.assertEqual(public_client.get(f"/api/resources/external-links/articles/{token}/").status_code, 403)
        self.assertEqual(public_client.get(f"/api/resources/external-links/articles/{token}/", HTTP_X_EXTERNAL_LINK_PASSWORD="secret").status_code, 200)
        response = self.client.patch(
            f"/api/resources/article-external-links/mine/{article.pk}/",
            {"expiry": "7d", "external_link_password": ""},
            format="json",
        )
        article.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(article.external_link_password)
        self.assertFalse(response.data["passwordProtected"])
        self.assertEqual(public_client.get(f"/api/resources/external-links/articles/{token}/").status_code, 200)

    def test_external_book_link_password_protects_chapters(self):
        article = Article.objects.create(author=self.user, title="Chapter", slug="protected-chapter")
        book = Book.objects.create(created_by=self.user, name="Protected book", slug="protected-book", structure=[{"type": "article", "article_id": article.pk}])

        response = self.client.post(
            f"/api/resources/book-external-links/mine/{book.pk}/",
            {"expiry": "7d", "external_link_password": "secret"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        token = response.data["token"]
        public_client = APIClient()
        self.assertEqual(public_client.get(f"/api/resources/external-links/books/{token}/").status_code, 403)
        self.assertEqual(public_client.get(f"/api/resources/external-links/books/{token}/articles/{article.slug}/", HTTP_X_EXTERNAL_LINK_PASSWORD="secret").status_code, 200)

    def test_book_external_link_management_and_public_chapter_filtering(self):
        staff = User.objects.create_user(username="staff-book-external", email="staff-book-external@example.com", password="password123", is_staff=True)
        public_article = Article.objects.create(author=self.user, title="Public chapter", slug="public-chapter")
        private_article = Article.objects.create(author=self.user, title="Private chapter", slug="private-chapter", visibility="private")
        book = Book.objects.create(created_by=self.user, name="Shared book", slug="shared-book", structure=[{"type": "article", "article_id": public_article.pk}, {"type": "article", "article_id": private_article.pk}])
        book.articles.set([public_article, private_article])
        self.client.force_authenticate(staff)

        response = self.client.post(f"/api/manage/book-external-links/{book.pk}/", {"expiry": "1d"}, format="json")

        self.assertEqual(response.status_code, 200)
        token = response.data["token"]
        self.assertEqual(response.data["url"], f"/external-link/books/{token}")
        self.assertEqual(self.client.get("/api/manage/book-external-links/").data["total"], 1)
        public_client = APIClient()
        shared = public_client.get(f"/api/resources/external-links/books/{token}/")
        self.assertEqual(shared.status_code, 200)
        self.assertEqual([article["slug"] for article in shared.data["articles"]], [public_article.slug])
        self.assertEqual(public_client.get(f"/api/resources/external-links/books/{token}/articles/{public_article.slug}/").status_code, 200)
        self.assertEqual(public_client.get(f"/api/resources/external-links/books/{token}/articles/{private_article.slug}/").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/manage/book-external-links/{book.pk}/", {"expiry": "30d"}, format="json").data["token"], token)
        self.assertEqual(self.client.delete(f"/api/manage/book-external-links/{book.pk}/").status_code, 204)

    def test_book_catalog_keeps_authorizable_articles_but_hides_other_private_articles(self):
        public_article = Article.objects.create(author=self.user, title="Public chapter", slug="catalog-public")
        restricted_article = Article.objects.create(
            author=self.user,
            title="Restricted chapter",
            slug="catalog-restricted",
            visibility="conditional",
            condition_rules=[{"type": "points", "value": 10}],
        )
        book_only_article = Article.objects.create(
            author=self.user,
            title="Book chapter",
            slug="catalog-book-only",
            visibility="conditional",
            condition_rules=[{"type": "book_only"}],
        )
        private_article = Article.objects.create(
            author=self.user,
            title="Private chapter",
            slug="catalog-private",
            visibility="private",
        )
        book = Book.objects.create(
            created_by=self.user,
            name="Catalog book",
            slug="catalog-book",
            structure=[
                {"type": "article", "article_id": public_article.pk},
                {"type": "article", "article_id": restricted_article.pk},
                {"type": "article", "article_id": book_only_article.pk},
                {"type": "article", "article_id": private_article.pk},
            ],
        )

        self.client.force_authenticate(self.other)
        catalog = self.client.get(
            "/api/resources/articles/",
            {"ids": ",".join(map(str, [public_article.pk, restricted_article.pk, book_only_article.pk, private_article.pk])), "bookId": book.pk},
        )

        self.assertEqual(catalog.status_code, 200)
        self.assertEqual(
            {item["slug"] for item in catalog.data["items"]},
            {public_article.slug, restricted_article.slug, book_only_article.slug},
        )
        decisions = {item["slug"]: item["accessDecision"] for item in catalog.data["items"]}
        self.assertTrue(decisions[public_article.slug]["all_granted"])
        self.assertFalse(decisions[restricted_article.slug]["all_granted"])
        self.assertTrue(decisions[book_only_article.slug]["all_granted"])

        self.client.force_authenticate(self.user)
        author_catalog = self.client.get("/api/resources/articles/", {"bookId": book.pk})
        self.assertEqual(
            {item["slug"] for item in author_catalog.data["items"]},
            {public_article.slug, restricted_article.slug, book_only_article.slug, private_article.slug},
        )

        manager = User.objects.create_user(
            username="catalog-manager",
            email="catalog-manager@example.com",
            password="password123",
            is_staff=True,
        )
        self.client.force_authenticate(manager)
        manager_catalog = self.client.get("/api/resources/articles/", {"bookId": book.pk})
        self.assertEqual(
            {item["slug"] for item in manager_catalog.data["items"]},
            {public_article.slug, restricted_article.slug, book_only_article.slug, private_article.slug},
        )

    def test_article_access_requires_a_valid_book_context(self):
        chapter = Article.objects.create(
            author=self.user,
            title="Book only chapter",
            slug="validated-book-context",
            visibility="conditional",
            condition_rules=[{"type": "book_only"}],
        )
        book = Book.objects.create(
            created_by=self.user,
            name="Context book",
            slug="context-book",
            structure=[{"type": "article", "article_id": chapter.pk}],
        )
        unrelated_book = Book.objects.create(
            created_by=self.user,
            name="Unrelated book",
            slug="unrelated-book",
            structure=[{"type": "article", "article_id": Article.objects.create(author=self.user, title="Other", slug="unrelated-chapter").pk}],
        )
        self.client.force_authenticate(self.other)

        valid = self.client.get(f"/api/resources/article/{chapter.pk}/access/", {"book_context": "true", "bookId": book.pk})
        invalid = self.client.get(f"/api/resources/article/{chapter.pk}/access/", {"book_context": "true", "bookId": unrelated_book.pk})
        missing = self.client.get(f"/api/resources/article/{chapter.pk}/access/", {"book_context": "true"})

        self.assertTrue(valid.data["all_granted"])
        self.assertFalse(invalid.data["all_granted"])
        self.assertFalse(missing.data["all_granted"])

    def test_book_external_link_is_cleared_when_book_becomes_non_public(self):
        article = Article.objects.create(author=self.user, title="Book chapter", slug="book-chapter")
        book = Book.objects.create(created_by=self.user, name="Visibility book", slug="visibility-book", structure=[{"type": "article", "article_id": article.pk}])
        rotate_book_external_link(book, "7d")
        book.save()
        token = book.external_link_token
        manager = User.objects.create_user(username="visibility-manager", email="visibility-manager@example.com", password="password123", is_staff=True)
        self.client.force_authenticate(manager)

        response = self.client.patch(f"/api/resources/books/{book.slug}/", {"visibility": "private"}, format="json")

        self.assertEqual(response.status_code, 200)
        book.refresh_from_db()
        self.assertIsNone(book.external_link_token)
        self.assertIsNone(book.external_link_expires_at)
        self.assertEqual(APIClient().get(f"/api/resources/external-links/books/{token}/").status_code, 404)

    def test_publishing_a_restricted_revision_clears_the_existing_external_link(self):
        article = Article.objects.create(author=self.user, title="Revision target", slug="revision-target")
        rotate_external_link(article, "7d")
        article.save()
        revision = self.client.post(f"/api/resources/articles/{article.slug}/revision/")
        self.assertEqual(revision.status_code, 201)

        response = self.client.patch(
            f"/api/resources/drafts/{revision.data['slug']}/",
            {"visibility": "private"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        response = self.client.post(f"/api/resources/drafts/{revision.data['slug']}/publish/")
        self.assertEqual(response.status_code, 200)
        article.refresh_from_db()
        self.assertIsNone(article.external_link_token)
        self.assertIsNone(article.external_link_expires_at)

    def test_publishing_a_revision_keeps_the_published_article_slug(self):
        article = Article.objects.create(author=self.user, title="Revision target", slug="revision-target")

        revision = self.client.post(f"/api/resources/articles/{article.slug}/revision/")

        self.assertEqual(revision.status_code, 201)
        self.assertEqual(revision.data["slug"], article.slug)
        saved = self.client.patch(
            f"/api/resources/drafts/{revision.data['slug']}/",
            {"title": "Updated revision target"},
            format="json",
        )
        self.assertEqual(saved.status_code, 200)
        published = self.client.post(f"/api/resources/drafts/{saved.data['slug']}/publish/")

        self.assertEqual(published.status_code, 200)
        self.assertEqual(published.data["slug"], article.slug)
        article.refresh_from_db()
        self.assertEqual(article.slug, "revision-target")

    def test_attachment_upload_creates_private_media_asset(self):
        uploaded = SimpleUploadedFile("notes.txt", b"notes", content_type="text/plain")
        response = self.client.post("/api/resources/attachments/", {"title": "Notes", "file": uploaded}, format="multipart")
        self.assertEqual(response.status_code, 201)
        attachment = Attachment.objects.get()
        self.assertEqual(response.data["assetId"], str(attachment.asset_id))
        self.assertEqual(MediaAsset.objects.get().kind, "attachment")
        self.assertEqual(attachment.asset.storage_key, f"content-assets/user-{self.user.pk}/attachments/{attachment.asset_id}")

    def test_attachment_can_reuse_an_uploaded_asset_with_its_own_access_rules(self):
        upload = self.client.post(
            "/api/resources/attachments/",
            {"title": "Original", "file": SimpleUploadedFile("notes.txt", b"notes")},
            format="multipart",
        )
        response = self.client.post(
            "/api/resources/attachments/",
            {
                "title": "Members notes",
                "reused_asset_id": upload.data["assetId"],
                "visibility": "conditional",
                "condition_rules": '[{"type":"points","value":20}]',
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(MediaAsset.objects.count(), 1)
        self.assertEqual(Attachment.objects.count(), 2)
        reused = Attachment.objects.get(pk=response.data["id"])
        self.assertEqual(str(reused.asset_id), upload.data["assetId"])
        self.assertEqual(reused.title, "Members notes")
        self.assertEqual(reused.condition_rules, [{"type": "points", "value": 20}])

    def test_conditional_access_requires_a_condition_for_all_resource_types(self):
        article = self.client.post(
            "/api/resources/articles/",
            {"title": "Conditional article", "visibility": "conditional", "condition_rules": []},
            format="json",
        )
        draft = self.client.post(
            "/api/resources/drafts/",
            {"title": "Conditional draft", "visibility": "conditional", "condition_rules": []},
            format="json",
        )
        manager = User.objects.create_user(username="condition-manager", email="condition-manager@example.com", password="password123", is_staff=True)
        self.client.force_authenticate(manager)
        book = self.client.post(
            "/api/resources/books/",
            {"name": "Conditional book", "summary": "", "structure": [], "visibility": "conditional", "condition_rules": []},
            format="json",
        )
        attachment = self.client.post(
            "/api/resources/attachments/",
            {"title": "Conditional attachment", "file": SimpleUploadedFile("notes.txt", b"notes"), "visibility": "conditional", "condition_rules": "[]"},
            format="multipart",
        )

        for response in (article, draft, book, attachment):
            self.assertEqual(response.status_code, 400)
            self.assertIn("condition_rules", response.data)

    def test_standalone_conditional_vip_access_requires_a_condition(self):
        response = self.client.post(
            "/api/resources/drafts/",
            {
                "title": "VIP conditional draft",
                "visibility": "private",
                "access_scope": "standalone",
                "vip_access_permission": "conditional",
                "vip_condition_rules": [],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("vip_condition_rules", response.data)

    def test_attachment_owner_can_search_update_and_delete_an_attachment(self):
        created = self.client.post(
            "/api/resources/attachments/",
            {"title": "Original", "file": SimpleUploadedFile("notes.txt", b"notes")},
            format="multipart",
        )
        attachment = Attachment.objects.get(pk=created.data["id"])
        listed = self.client.get("/api/resources/attachments/", {"query": "notes", "ordering": "title"})
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data["total"], 1)
        updated = self.client.patch(f"/api/resources/attachments/{attachment.pk}/", {"title": "Renamed"}, format="json")
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["title"], "Renamed")
        deleted = self.client.delete(f"/api/resources/attachments/{attachment.pk}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(Attachment.objects.exists())
        self.assertFalse(MediaAsset.objects.exists())

    def test_attachment_delete_removes_reused_media_asset(self):
        created = self.client.post(
            "/api/resources/attachments/",
            {"title": "First", "file": SimpleUploadedFile("notes.txt", b"notes")},
            format="multipart",
        )
        self.client.post(
            "/api/resources/attachments/",
            {"title": "Second", "reused_asset_id": created.data["assetId"]},
            format="multipart",
        )
        self.client.delete(f"/api/resources/attachments/{created.data['id']}/")
        self.assertFalse(Attachment.objects.exists())
        self.assertFalse(MediaAsset.objects.exists())

    def test_attachment_delete_removes_shared_records_references_and_file(self):
        created = self.client.post(
            "/api/resources/attachments/",
            {"title": "First", "file": SimpleUploadedFile("notes.txt", b"notes")},
            format="multipart",
        )
        asset = MediaAsset.objects.get(pk=created.data["assetId"])
        asset_name = asset.file.name
        reused = Attachment.objects.create(
            title="Second",
            asset=asset,
            original_filename=asset.original_filename,
            mime_type=asset.media_type,
            file_size=asset.file_size,
            uploaded_by=self.user,
        )
        article = Article.objects.create(author=self.user, title="Uses attachment", slug="uses-attachment")
        MediaAssetReference.objects.create(asset=asset, resource_type="article", resource_id=article.pk)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(f"/api/resources/attachments/{created.data['id']}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Attachment.objects.filter(pk__in=(created.data["id"], reused.pk)).exists())
        self.assertFalse(MediaAssetReference.objects.filter(asset_id=asset.pk).exists())
        self.assertFalse(MediaAsset.objects.filter(pk=asset.pk).exists())
        self.assertFalse(default_storage.exists(asset_name))

    def test_attachment_update_keeps_existing_password_when_rule_value_is_omitted(self):
        created = self.client.post(
            "/api/resources/attachments/",
            {
                "title": "Protected",
                "file": SimpleUploadedFile("notes.txt", b"notes"),
                "visibility": "conditional",
                "condition_rules": '[{"type":"encrypted","value":"secret"}]',
            },
            format="multipart",
        )
        attachment = Attachment.objects.get(pk=created.data["id"])
        original_hash = attachment.condition_rules[0]["value"]

        response = self.client.patch(
            f"/api/resources/attachments/{attachment.pk}/",
            {"condition_rules": [{"type": "encrypted"}]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        attachment.refresh_from_db()
        self.assertEqual(attachment.condition_rules[0]["value"], original_hash)

    def test_draft_update_keeps_existing_password_when_rule_value_is_omitted(self):
        created = self.client.post(
            "/api/resources/drafts/",
            {
                "title": "Protected",
                "visibility": "conditional",
                "condition_rules": [{"type": "encrypted", "value": "secret"}],
            },
            format="json",
        )
        draft = ArticleDraft.objects.get(pk=created.data["id"])
        original_hash = draft.condition_rules[0]["value"]

        response = self.client.patch(
            f"/api/resources/drafts/{draft.slug}/",
            {"title": "Renamed", "condition_rules": [{"type": "encrypted"}]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["condition_rules"], [{"type": "encrypted"}])
        draft.refresh_from_db()
        self.assertEqual(draft.condition_rules[0]["value"], original_hash)

    def test_article_update_keeps_existing_password_when_rule_value_is_omitted(self):
        created = self.client.post(
            "/api/resources/articles/",
            {
                "title": "Protected",
                "visibility": "conditional",
                "condition_rules": [{"type": "encrypted", "value": "secret"}],
            },
            format="json",
        )
        article = Article.objects.get(pk=created.data["id"])
        original_hash = article.condition_rules[0]["value"]

        response = self.client.patch(
            f"/api/resources/articles/{article.slug}/",
            {"title": "Renamed", "condition_rules": [{"type": "encrypted"}]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        article.refresh_from_db()
        self.assertEqual(article.condition_rules[0]["value"], original_hash)

    def test_draft_update_keeps_existing_vip_password_when_rule_value_is_omitted(self):
        created = self.client.post(
            "/api/resources/drafts/",
            {
                "title": "VIP protected",
                "visibility": "private",
                "access_scope": "standalone",
                "vip_access_permission": "conditional",
                "vip_condition_rules": [{"type": "encrypted", "value": "secret"}],
            },
            format="json",
        )
        draft = ArticleDraft.objects.get(pk=created.data["id"])
        original_hash = draft.vip_condition_rules[0]["value"]

        response = self.client.patch(
            f"/api/resources/drafts/{draft.slug}/",
            {"vip_condition_rules": [{"type": "encrypted"}]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        draft.refresh_from_db()
        self.assertEqual(draft.vip_condition_rules[0]["value"], original_hash)

    def test_new_encrypted_condition_requires_a_password(self):
        response = self.client.post(
            "/api/resources/drafts/",
            {
                "title": "Missing password",
                "visibility": "conditional",
                "condition_rules": [{"type": "encrypted"}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("condition_rules", response.data)

    def test_public_attachment_always_uses_unified_access_scope(self):
        created = self.client.post(
            "/api/resources/attachments/",
            {
                "title": "Public",
                "file": SimpleUploadedFile("notes.txt", b"notes"),
                "visibility": "public",
                "access_scope": "standalone",
            },
            format="multipart",
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["access_scope"], "unified")

    def test_attachment_policy_change_clears_inapplicable_conditions(self):
        created = self.client.post(
            "/api/resources/attachments/",
            {
                "title": "Conditional",
                "file": SimpleUploadedFile("notes.txt", b"notes"),
                "visibility": "conditional",
                "condition_rules": '[{"type":"points","value":100}]',
                "access_scope": "standalone",
                "vip_access_permission": "conditional",
                "vip_condition_rules": '[{"type":"money","value":10}]',
            },
            format="multipart",
        )

        response = self.client.patch(
            f"/api/resources/attachments/{created.data['id']}/",
            {"visibility": "private"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["condition_rules"], [])
        self.assertEqual(response.data["vip_condition_rules"], [{"type": "money", "value": 10}])

        response = self.client.patch(
            f"/api/resources/attachments/{created.data['id']}/",
            {"access_scope": "unified"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["vip_access_permission"], "public")
        self.assertEqual(response.data["vip_condition_rules"], [])

        response = self.client.patch(
            f"/api/resources/attachments/{created.data['id']}/",
            {"visibility": "public"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["access_scope"], "unified")
        self.assertEqual(response.data["condition_rules"], [])

    def test_managed_attachment_list_requires_manager_and_returns_uploaders(self):
        self.client.post(
            "/api/resources/attachments/",
            {"title": "Notes", "file": SimpleUploadedFile("notes.txt", b"notes")},
            format="multipart",
        )
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get("/api/manage/attachments/").status_code, 403)
        staff = User.objects.create_user(username="attachment-staff", password="password123", is_staff=True)
        self.client.force_authenticate(staff)
        response = self.client.get("/api/manage/attachments/", {"query": "author"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["items"][0]["uploadedBy"]["username"], self.user.username)

    def test_article_inline_asset_is_moved_to_the_article_directory(self):
        upload = self.client.post(
            "/api/resources/media/image/",
            {"image": SimpleUploadedFile("preview.png", b"image", content_type="image/png")},
            format="multipart",
        )
        asset = MediaAsset.objects.get(pk=upload.data["assetId"])
        self.assertEqual(asset.storage_key, f"content-assets/user-{self.user.pk}/uploads/{asset.pk}")

        response = self.client.post(
            "/api/resources/articles/",
            {"title": "With asset", "content": f'::image{{assetId="{asset.pk}"}}'},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        asset.refresh_from_db()
        article = Article.objects.get(pk=response.data["id"])
        self.assertEqual(asset.storage_key, f"content-assets/user-{self.user.pk}/articles/{article.pk}/{asset.pk}")
        self.assertTrue(default_storage.exists(asset.storage_key))

    def test_article_cover_is_uploaded_with_multipart_to_its_stable_namespace(self):
        response = self.client.post(
            "/api/resources/articles/",
            {"title": "Covered", "cover_image": SimpleUploadedFile("cover.gif", b"GIF87a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;", content_type="image/gif")},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        article = Article.objects.get(pk=response.data["id"])
        self.assertEqual(article.cover_image.name, f"content-assets/user-{self.user.pk}/articles/{article.pk}/background.gif")

    def test_draft_cover_is_uploaded_with_multipart_to_its_stable_namespace(self):
        response = self.client.post(
            "/api/resources/drafts/",
            {"title": "Covered draft", "cover_image": SimpleUploadedFile("cover.gif", b"GIF87a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;", content_type="image/gif")},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        draft = ArticleDraft.objects.get(pk=response.data["id"])
        self.assertEqual(draft.cover_image.name, f"content-assets/user-{self.user.pk}/articles/{draft.article_id}/background.gif")

    def test_cover_urls_are_delivered_without_exposing_media_paths(self):
        image = SimpleUploadedFile("cover.gif", b"GIF87a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;", content_type="image/gif")
        created = self.client.post("/api/resources/articles/", {"title": "Covered", "cover_image": image}, format="multipart")

        self.assertNotIn("cover_image", created.data)
        self.assertTrue(created.data["coverUrl"].startswith("/api/resources/public-media/articles/"))
        self.assertNotIn("/media/", created.data["coverUrl"])
        self.client.force_authenticate(None)
        response = self.client.get(created.data["coverUrl"])
        self.assertEqual(response.status_code, 200)
        response.close()

    def test_private_cover_url_is_signed_and_not_issued_to_an_unauthorized_viewer(self):
        image = SimpleUploadedFile("cover.gif", b"GIF87a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;", content_type="image/gif")
        created = self.client.post("/api/resources/articles/", {"title": "Private", "visibility": "private", "cover_image": image}, format="multipart")
        self.assertTrue(created.data["coverUrl"].startswith("/api/resources/media-delivery/"))
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(created.data["coverUrl"]).status_code, 200)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f"/api/resources/articles/{created.data['slug']}/").status_code, 403)

    def test_draft_cover_uses_a_signed_delivery_url(self):
        image = SimpleUploadedFile("cover.gif", b"GIF87a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;", content_type="image/gif")
        created = self.client.post("/api/resources/drafts/", {"title": "Covered draft", "cover_image": image}, format="multipart")

        self.assertNotIn("cover_image", created.data)
        self.assertTrue(created.data["coverUrl"].startswith("/api/resources/media-delivery/"))
        self.client.force_authenticate(None)
        delivered = self.client.get(created.data["coverUrl"])
        self.assertEqual(delivered.status_code, 200)
        delivered.close()

    def test_replaced_draft_cover_invalidates_its_previous_delivery_url(self):
        first = SimpleUploadedFile("first.gif", b"GIF87a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;", content_type="image/gif")
        created = self.client.post("/api/resources/drafts/", {"title": "Replace cover", "cover_image": first}, format="multipart")
        previous_url = created.data["coverUrl"]
        replacement = SimpleUploadedFile("replacement.gif", b"GIF87a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;", content_type="image/gif")
        updated = self.client.patch(f"/api/resources/drafts/{created.data['slug']}/", {"cover_image": replacement}, format="multipart")

        self.assertNotEqual(updated.data["coverUrl"], previous_url)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(previous_url).status_code, 404)

    def test_article_delete_removes_its_inline_assets_and_cover(self):
        upload = self.client.post(
            "/api/resources/media/image/",
            {"image": SimpleUploadedFile("preview.png", b"image", content_type="image/png")},
            format="multipart",
        )
        asset = MediaAsset.objects.get(pk=upload.data["assetId"])
        created = self.client.post(
            "/api/resources/articles/",
            {"title": "Disposable", "content": f'::image{{assetId="{asset.pk}"}}'},
            format="json",
        )
        article = Article.objects.get(pk=created.data["id"])
        asset.refresh_from_db()
        asset_name = asset.file.name
        article.cover_image = SimpleUploadedFile("cover.png", b"cover", content_type="image/png")
        article.save()
        cover_name = article.cover_image.name

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(f"/api/resources/articles/{article.slug}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Article.objects.filter(pk=article.pk).exists())
        self.assertFalse(MediaAsset.objects.filter(pk=asset.pk).exists())
        self.assertFalse(MediaAssetReference.objects.filter(asset_id=asset.pk).exists())
        self.assertFalse(default_storage.exists(asset_name))
        self.assertFalse(default_storage.exists(cover_name))

    def test_article_delete_removes_book_nodes_without_deleting_books(self):
        article = Article.objects.create(author=self.user, title="Chapter", slug="chapter")
        other = Article.objects.create(author=self.user, title="Other", slug="other")
        book = Book.objects.create(
            created_by=self.user,
            name="Guide",
            slug="guide",
            structure=[
                {"type": "article", "article_id": article.pk},
                {"type": "group", "title": "Part", "children": [{"type": "article", "article_id": article.pk}, {"type": "article", "article_id": other.pk}]},
            ],
        )
        book.articles.set((article, other))

        response = self.client.delete(f"/api/resources/articles/{article.slug}/")

        self.assertEqual(response.status_code, 204)
        book.refresh_from_db()
        self.assertEqual(list_article_ids(book.structure), [other.pk])
        self.assertTrue(Book.objects.filter(pk=book.pk).exists())

    def test_draft_publish_and_revision_keep_article_media_namespace(self):
        draft = self.client.post("/api/resources/drafts/", {"title": "New draft", "content": "body", "suppress_detail_hero": True}, format="json")
        self.assertEqual(draft.status_code, 201)
        self.assertTrue(draft.data["suppress_detail_hero"])
        published = self.client.post(f"/api/resources/drafts/{draft.data['slug']}/publish/")
        self.assertEqual(published.status_code, 200)
        article = Article.objects.get(pk=draft.data["article_id"])
        self.assertTrue(article.suppress_detail_hero)
        self.assertTrue(published.data["suppress_detail_hero"])
        revision = self.client.post(f"/api/resources/articles/{article.slug}/revision/")
        self.assertEqual(revision.status_code, 201)
        self.assertEqual(revision.data["article_id"], article.pk)
        self.assertTrue(revision.data["suppress_detail_hero"])
        self.assertTrue(ArticleDraft.objects.get(pk=revision.data["id"]).suppress_detail_hero)
        self.client.delete(f"/api/resources/drafts/{revision.data['slug']}/")
        self.assertTrue(Article.objects.filter(pk=article.pk).exists())

    def test_standalone_draft_delete_removes_inline_assets_references_and_cover(self):
        upload = self.client.post(
            "/api/resources/media/image/",
            {"image": SimpleUploadedFile("preview.png", b"image", content_type="image/png")},
            format="multipart",
        )
        asset = MediaAsset.objects.get(pk=upload.data["assetId"])
        draft_response = self.client.post(
            "/api/resources/drafts/",
            {"title": "Disposable draft", "content": f'::image{{assetId="{asset.pk}"}}'},
            format="json",
        )
        draft = ArticleDraft.objects.get(pk=draft_response.data["id"])
        asset.refresh_from_db()
        asset_name = asset.file.name
        draft.cover_image = SimpleUploadedFile("cover.png", b"cover", content_type="image/png")
        draft.save()
        cover_name = draft.cover_image.name

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(f"/api/resources/drafts/{draft.slug}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(ArticleDraft.objects.filter(pk=draft.pk).exists())
        self.assertFalse(MediaAssetReference.objects.filter(asset_id=asset.pk).exists())
        self.assertFalse(MediaAsset.objects.filter(pk=asset.pk).exists())
        self.assertFalse(default_storage.exists(asset_name))
        self.assertFalse(default_storage.exists(cover_name))

    @patch("apps.resources.services.max_upload_size", return_value=1024 * 1024)
    def test_oversized_attachment_returns_a_field_error_without_creating_resources(self, _max_upload_size):
        response = self.client.post("/api/resources/attachments/", {"title": "Too large", "file": SimpleUploadedFile("large.txt", b"0" * (1024 * 1024 + 1), content_type="text/plain")}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["file"], ["The uploaded file exceeds the 1 MB size limit."])
        self.assertFalse(Attachment.objects.exists())
        self.assertFalse(MediaAsset.objects.exists())

    def test_personal_storage_capacity_rejects_media_and_allows_staff(self):
        self.addCleanup(lambda: cache.delete("site-settings:all:v1"))
        SiteSetting.objects.update_or_create(
            key="user.rewards",
            defaults={"value": {"daily_login_reward_money": 10, "daily_login_reward_points": 10, "storage_capacity_mb": 0}},
        )
        cache.delete("site-settings:all:v1")
        response = self.client.post(
            "/api/resources/media/image/",
            {"image": SimpleUploadedFile("blocked.png", b"image", content_type="image/png")},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "storage_quota_exceeded")
        self.assertFalse(MediaAsset.objects.exists())

        staff = User.objects.create_user(username="staff", email="staff@example.com", password="password123", is_staff=True)
        self.client.force_authenticate(staff)
        response = self.client.post(
            "/api/resources/media/image/",
            {"image": SimpleUploadedFile("allowed.png", b"image", content_type="image/png")},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)

    def test_media_upload_returns_an_inline_preview_url(self):
        response = self.client.post("/api/resources/media/image/", {"image": SimpleUploadedFile("preview.png", b"image", content_type="image/png")}, format="multipart")
        self.assertEqual(response.status_code, 201)
        self.assertIn("previewUrl", response.data)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(response.data["previewUrl"]).status_code, 200)

    def test_video_upload_enforces_the_active_upload_policy(self):
        vip = User.objects.create_user(username="video-vip", email="video-vip@example.com", password="password123")
        vip.groups.add(Group.objects.create(name="vip_1"))
        staff = User.objects.create_user(username="video-staff", email="video-staff@example.com", password="password123", is_staff=True)

        self._set_video_upload_policy(allow_user_upload=True, vip_only=False)
        self.assertEqual(self._upload_video_as(self.user).status_code, 201)

        self._set_video_upload_policy(allow_user_upload=True, vip_only=True)
        self.assertEqual(self._upload_video_as(self.user).status_code, 403)
        self.assertEqual(self._upload_video_as(vip).status_code, 201)

        self._set_video_upload_policy(allow_user_upload=False, vip_only=False)
        self.assertEqual(self._upload_video_as(vip).status_code, 403)
        self.assertEqual(self._upload_video_as(staff).status_code, 201)

    def _set_video_upload_policy(self, *, allow_user_upload, vip_only):
        SiteSetting.objects.update_or_create(
            key="upload.video",
            defaults={"value": {"allow_user_upload": allow_user_upload, "vip_only": vip_only, "max_size_mb": 200}},
        )
        cache.delete("site-settings:all:v1")

    def _upload_video_as(self, user):
        self.client.force_authenticate(user)
        return self.client.post(
            "/api/resources/media/video/",
            {"video": SimpleUploadedFile("video.mp4", b"video", content_type="video/mp4")},
            format="multipart",
        )

    def test_public_article_context_can_download_public_attachment(self):
        upload = self.client.post("/api/resources/attachments/", {"title": "Notes", "file": SimpleUploadedFile("notes.txt", b"notes")}, format="multipart")
        attachment = Attachment.objects.get()
        article = Article.objects.create(author=self.user, title="Public", slug="public", content=f'::custom{{kind="attachment" assetId="{attachment.asset_id}"}}')
        MediaAssetReference.objects.create(asset=attachment.asset, resource_type="article", resource_id=article.pk)
        manifest = self.client.post(f"/api/resources/articles/{article.slug}/asset-manifest/", {"assetIds": [str(attachment.asset_id)]}, format="json")
        self.assertEqual(manifest.status_code, 200)
        manifest_attachment = manifest.data["assets"][str(attachment.asset_id)]
        self.assertEqual(manifest_attachment["attachmentId"], attachment.pk)
        self.assertEqual(manifest_attachment["visibility"], "public")
        self.assertTrue(manifest_attachment["accessDecision"]["all_granted"])
        self.assertEqual(manifest_attachment["downloadState"], "granted")
        response = self.client.post(f"/api/resources/articles/{article.slug}/assets/{attachment.asset_id}/download/")
        self.assertEqual(response.status_code, 200)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(response.data["url"]).status_code, 200)
        self.assertEqual(Attachment.objects.get().download_count, 1)

    def test_asset_manifest_keeps_inline_media_without_an_attachment_record(self):
        asset = MediaAsset.objects.create(
            kind=MediaAsset.KIND_IMAGE,
            file=SimpleUploadedFile("image.png", b"image", content_type="image/png"),
            original_filename="image.png",
            uploaded_by=self.user,
        )
        article = Article.objects.create(
            author=self.user,
            title="With image",
            slug="with-image",
            content=f'::image{{assetId="{asset.pk}"}}',
        )
        MediaAssetReference.objects.create(
            asset=asset,
            resource_type="article",
            resource_id=article.pk,
        )

        response = self.client.post(
            f"/api/resources/articles/{article.slug}/asset-manifest/",
            {"assetIds": [str(asset.pk)]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn(str(asset.pk), response.data["assets"])
        self.assertEqual(response.data["assets"][str(asset.pk)]["kind"], "image")

    def test_book_context_grants_book_only_attachment_in_manifest_and_download(self):
        upload = self.client.post(
            "/api/resources/attachments/",
            {
                "title": "Book notes",
                "file": SimpleUploadedFile("notes.txt", b"notes"),
                "visibility": "conditional",
                "condition_rules": '[{"type":"book_only"}]',
            },
            format="multipart",
        )
        self.assertEqual(upload.status_code, 201)
        attachment = Attachment.objects.get()
        book = Book.objects.create(created_by=self.user, name="Guide", slug="guide")
        MediaAssetReference.objects.create(
            asset=attachment.asset,
            resource_type="book",
            resource_id=book.pk,
        )

        self.client.force_authenticate(self.other)
        direct = self.client.get(f"/api/resources/attachment/{attachment.pk}/access/")
        self.assertFalse(direct.data["all_granted"])
        self.assertEqual(direct.data["conditions"][0]["type"], "book_only")

        manifest = self.client.post(
            f"/api/resources/books/{book.slug}/asset-manifest/",
            {"assetIds": [str(attachment.asset_id)]},
            format="json",
        )
        self.assertEqual(manifest.status_code, 200)
        self.assertTrue(manifest.data["assets"][str(attachment.asset_id)]["accessDecision"]["all_granted"])

        response = self.client.post(
            f"/api/resources/books/{book.slug}/assets/{attachment.asset_id}/download/"
        )
        self.assertEqual(response.status_code, 200)

    def test_article_book_context_grants_book_only_attachment_in_manifest_and_download(self):
        upload = self.client.post(
            "/api/resources/attachments/",
            {
                "title": "Chapter notes",
                "file": SimpleUploadedFile("notes.txt", b"notes"),
                "visibility": "conditional",
                "condition_rules": '[{"type":"book_only"}]',
            },
            format="multipart",
        )
        self.assertEqual(upload.status_code, 201)
        attachment = Attachment.objects.get()
        article = Article.objects.create(
            author=self.user,
            title="Chapter",
            slug="chapter",
            content=(
                f'::custom{{kind="attachment" assetId="{attachment.asset_id}" '
                f'attachmentId="{attachment.pk}"}}'
            ),
        )
        MediaAssetReference.objects.create(
            asset=attachment.asset,
            resource_type="article",
            resource_id=article.pk,
        )
        book = Book.objects.create(
            created_by=self.user,
            name="Guide",
            slug="guide",
            structure=[{"type": "article", "article_id": article.pk}],
        )

        self.client.force_authenticate(self.other)
        manifest = self.client.post(
            f"/api/resources/articles/{article.slug}/asset-manifest/?bookId={book.pk}",
            {
                "assetIds": [str(attachment.asset_id)],
                "attachmentIds": [str(attachment.pk)],
            },
            format="json",
        )
        self.assertEqual(manifest.status_code, 200)
        self.assertTrue(
            manifest.data["assets"][str(attachment.pk)]["accessDecision"]["all_granted"]
        )

        response = self.client.post(
            f"/api/resources/articles/{article.slug}/assets/{attachment.asset_id}/download/?bookId={book.pk}",
            {"attachmentId": attachment.pk},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

    def test_standalone_attachment_uses_common_or_vip_condition_channel(self):
        asset = MediaAsset.objects.create(
            kind=MediaAsset.KIND_ATTACHMENT,
            file=SimpleUploadedFile("rules.txt", b"rules"),
            storage_key="content-assets/test/rules",
            original_filename="rules.txt",
            uploaded_by=self.user,
        )
        attachment = Attachment.objects.create(
            title="Standalone conditions",
            asset=asset,
            original_filename="rules.txt",
            uploaded_by=self.user,
            visibility="conditional",
            condition_rules=[
                {"type": "money", "value": 30},
                {"type": "points", "value": 100},
                {"type": "encrypted", "value": make_password("common-password")},
            ],
            access_scope="standalone",
            vip_access_permission="conditional",
            vip_condition_rules=[
                {"type": "money", "value": 10},
                {"type": "encrypted", "value": make_password("vip-password")},
            ],
        )
        self.client.force_authenticate(self.other)
        common = self.client.get(f"/api/resources/attachment/{attachment.pk}/access/")
        self.assertEqual(common.data["effective_channel"], "common")
        self.assertEqual([condition["type"] for condition in common.data["conditions"]], ["money", "points", "encrypted"])

        vip_group, _ = Group.objects.get_or_create(name="vip_1")
        self.other.groups.add(vip_group)
        vip = self.client.get(f"/api/resources/attachment/{attachment.pk}/access/")
        self.assertEqual(vip.data["effective_channel"], "vip")
        self.assertEqual([condition["type"] for condition in vip.data["conditions"]], ["money", "encrypted"])

    def test_book_uses_required_table_name_and_article_relation(self):
        article = Article.objects.create(author=self.user, title="Chapter", slug="chapter")
        manager = User.objects.create_user(username="book-test-manager", email="book-test-manager@example.com", password="password123", is_staff=True)
        self.client.force_authenticate(manager)
        response = self.client.post("/api/resources/books/", {"name": "Guide", "structure": [{"type": "article", "article_id": article.pk}]}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Book._meta.db_table, "books")
        self.assertEqual(response.data["articleCount"], 1)

    def test_book_requires_an_article(self):
        manager = User.objects.create_user(username="empty-book-manager", email="empty-book-manager@example.com", password="password123", is_staff=True)
        self.client.force_authenticate(manager)
        response = self.client.post("/api/resources/books/", {"name": "Empty guide", "structure": []}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("structure", response.data)

    def test_book_create_does_not_read_back_from_zincsearch(self):
        article = Article.objects.create(author=self.user, title="Chapter", slug="new-book-chapter")
        manager = User.objects.create_user(username="new-book-manager", email="new-book-manager@example.com", password="password123", is_staff=True)
        self.client.force_authenticate(manager)

        with patch("apps.resources.serializers.index_book"), patch(
            "apps.resources.serializers.get_book_document",
            side_effect=RuntimeError("document is not searchable yet"),
        ):
            response = self.client.post(
                "/api/resources/books/",
                {"name": "New guide", "abstract": "New abstract", "structure": [{"type": "article", "article_id": article.pk}]},
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["abstract"], "New abstract")

    def test_conditional_book_exposes_cover_in_discovery_without_granting_access(self):
        article = Article.objects.create(author=self.user, title="Chapter", slug="chapter")
        book = Book.objects.create(
            created_by=self.user,
            name="Conditional guide",
            slug="conditional-guide",
            visibility="conditional",
            condition_rules=[{"type": "points", "value": 10}],
            structure=[{"type": "article", "article_id": article.pk}],
        )
        book.cover_image = SimpleUploadedFile("cover.gif", b"GIF87a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;", content_type="image/gif")
        book.save()
        self.client.force_authenticate(self.other)
        listing = self.client.get("/api/resources/books/")
        item = next(item for item in listing.data["items"] if item["id"] == book.pk)
        self.assertTrue(item["coverUrl"])
        self.assertEqual(self.client.get(f"/api/resources/books/{book.slug}/").status_code, 403)

    def test_managed_books_are_staff_only_and_can_be_deleted_without_articles(self):
        article = Article.objects.create(author=self.user, title="Chapter", slug="chapter")
        book = Book.objects.create(
            created_by=self.user,
            name="Guide",
            slug="guide",
            structure=[{"type": "article", "article_id": article.pk}],
        )
        book.articles.add(article)

        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get("/api/manage/books/").status_code, 403)

        manager = User.objects.create_user(username="manager", email="manager@example.com", password="password123", is_staff=True)
        self.client.force_authenticate(manager)
        listing = self.client.get("/api/manage/books/?query=guide&ordering=-article_count")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.data["total"], 1)
        self.assertEqual(listing.data["items"][0]["articleCount"], 1)
        self.assertEqual(listing.data["items"][0]["author"]["username"], self.user.username)

        self.assertEqual(self.client.delete(f"/api/manage/books/{book.slug}/").status_code, 204)
        self.assertFalse(Book.objects.filter(pk=book.pk).exists())
        self.assertTrue(Article.objects.filter(pk=article.pk).exists())

    def test_book_search_excludes_summary(self):
        Book.objects.create(
            created_by=self.user,
            name="Personal book",
            slug="personal-book-slug",
            summary="personal-summary-only",
        )

        self.assertEqual(self.client.get("/api/resources/books/mine/?query=personal-book").data["total"], 1)
        self.assertEqual(self.client.get("/api/resources/books/mine/?query=personal-summary-only").data["total"], 0)

        staff = User.objects.create_user(username="staff", email="staff@example.com", password="password123", is_staff=True)
        Book.objects.create(
            created_by=self.other,
            name="Managed book",
            slug="managed-book-slug",
            summary="managed-summary-only",
        )
        self.client.force_authenticate(staff)

        self.assertEqual(self.client.get("/api/manage/books/?query=managed-book").data["total"], 1)
        self.assertEqual(self.client.get("/api/manage/books/?query=reader").data["total"], 1)
        self.assertEqual(self.client.get("/api/manage/books/?query=managed-summary-only").data["total"], 0)

    def test_managed_book_create_and_cover_use_canonical_book_path(self):
        manager = User.objects.create_user(username="manager", email="manager@example.com", password="password123", is_staff=True)
        article = Article.objects.create(author=manager, title="Chapter", slug="chapter")
        self.client.force_authenticate(manager)
        image = SimpleUploadedFile("cover.gif", b"GIF87a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;", content_type="image/gif")
        created = self.client.post("/api/manage/books/", {"name": "Covered guide", "structure": '[{"type":"article","article_id":%s}]' % article.pk, "cover_image": image}, format="multipart")
        self.assertEqual(created.status_code, 201)
        book = Book.objects.get(pk=created.data["id"])
        self.assertEqual(book.cover_image.name, f"content-assets/user-{manager.pk}/books/{book.pk}/background.gif")

        updated = self.client.patch(f"/api/manage/books/{book.slug}/", {"remove_cover": True}, format="multipart")
        self.assertEqual(updated.status_code, 200)
        book.refresh_from_db()
        self.assertFalse(book.cover_image)

    def test_article_list_discovers_conditional_content_and_paginates(self):
        tag = Tag.objects.create(name="Guides")
        for index in range(13):
            article = Article.objects.create(
                author=self.user,
                title=f"Guide {index}",
                slug=f"guide-{index}",
                visibility="conditional" if index == 0 else "public",
                condition_rules=[{"type": "money", "value": 10}] if index == 0 else [],
            )
            article.tags.add(tag)
        self.client.force_authenticate(self.other)
        response = self.client.get("/api/resources/articles/?tag=Guides&page=2&pageSize=12")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 13)
        self.assertEqual(response.data["page"], 2)
        self.assertEqual(len(response.data["items"]), 1)
        self.assertNotIn("pbkdf2", str(response.data))

    def test_article_list_filters_numeric_tag_names_as_names(self):
        numeric_tag = Tag.objects.create(name="2026")
        matching_article = Article.objects.create(author=self.user, title="Release notes", slug="release-notes")
        matching_article.tags.add(numeric_tag)
        other_tag = Tag.objects.create(name="Other")
        other_article = Article.objects.create(author=self.user, title="Other article", slug="other-article")
        other_article.tags.add(other_tag)

        response = self.client.get("/api/resources/articles/?tag=2026")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 1)
        self.assertEqual(response.data["items"][0]["id"], matching_article.pk)

    def test_resource_interactions_update_list_dto_and_sort_stars_first(self):
        first = Article.objects.create(author=self.user, title="First", slug="first")
        second = Article.objects.create(author=self.user, title="Second", slug="second")
        self.client.force_authenticate(self.other)
        star = self.client.put("/api/resources/articles/first/star/", {"starred": True}, format="json")
        vote = self.client.put("/api/resources/articles/first/vote/", {"vote": "up"}, format="json")
        listing = self.client.get("/api/resources/articles/?sort=starred")
        self.assertEqual(star.status_code, 200)
        self.assertEqual(vote.status_code, 200)
        self.assertEqual(listing.data["items"][0]["id"], first.pk)
        self.assertTrue(listing.data["items"][0]["interaction"]["isStarred"])
        self.assertEqual(listing.data["items"][0]["interaction"]["currentVote"], "up")
        self.assertEqual(listing.data["items"][0]["interaction"]["upCount"], 1)
