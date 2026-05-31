from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.blog.models import Book, BookShareLink, ContentViewLog, Post, PostShareLink
from apps.blog.utils import get_or_create_site_setting
from apps.blog.permissions import hash_condition_password
from apps.blog.views.post.utils.draft import clone_post_to_draft, publish_post_draft
from apps.users.models import UserProfile


User = get_user_model()


class EncryptedAccessFlowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="reader", password="login-pass")
        self.client.force_login(self.user)
        self.profile, _created = UserProfile.objects.get_or_create(user=self.user)

    def test_encrypted_post_unlock_grants_access_for_conditional_visibility(self):
        author = User.objects.create_user(username="post-author", password="login-pass")
        post = Post.objects.create(
            title="Encrypted post",
            slug="encrypted-post",
            summary="summary",
            content="secret",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_CONDITIONAL,
            author=author,
            condition_rules=[{"type": "encrypted", "value": hash_condition_password("secret-pass")}],
        )

        response = self.client.post(
            reverse("blog-detail", kwargs={"slug": post.slug}),
            {"password": "secret-pass"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["redirect_url"], post.get_absolute_url())

        detail_response = self.client.get(post.get_absolute_url())

        self.assertEqual(detail_response.status_code, 200)
        self.assertContains(detail_response, "secret")
        self.assertNotContains(detail_response, 'data-encrypted-post-modal')

    def test_multi_condition_book_password_unlock_does_not_report_incorrect_password(self):
        book = Book.objects.create(
            name="Encrypted book",
            slug="encrypted-book",
            summary="summary",
            visibility=Book.VISIBILITY_CONDITIONAL,
            created_by=self.user,
            condition_rules=[
                {"type": "encrypted", "value": hash_condition_password("book-pass")},
                {"type": "money", "value": 50},
            ],
        )
        other_user = User.objects.create_user(username="other-reader", password="login-pass")
        UserProfile.objects.get_or_create(user=other_user)
        self.client.force_login(other_user)

        response = self.client.post(
            reverse("book-detail", kwargs={"slug": book.slug}),
            {"password": "book-pass"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["redirect_url"], book.get_absolute_url())

        detail_response = self.client.get(book.get_absolute_url())

        self.assertEqual(detail_response.status_code, 200)
        self.assertContains(detail_response, 'data-conditional-access-modal')
        self.assertNotContains(detail_response, 'data-encrypted-post-modal')
        self.assertNotContains(detail_response, 'Incorrect password')

    def test_multi_condition_post_requires_password_before_condition_modal(self):
        author = User.objects.create_user(username="multi-post-author", password="login-pass")
        post = Post.objects.create(
            title="Encrypted and points post",
            slug="encrypted-points-post",
            summary="summary",
            content="secret",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_CONDITIONAL,
            author=author,
            condition_rules=[
                {"type": "encrypted", "value": hash_condition_password("first-pass")},
                {"type": "points", "value": 10},
            ],
        )

        detail_response = self.client.get(post.get_absolute_url())

        self.assertEqual(detail_response.status_code, 200)
        self.assertContains(detail_response, 'data-encrypted-post-modal')
        self.assertNotContains(detail_response, 'data-conditional-access-modal')

        purchase_response = self.client.post(
            reverse("blog-detail", kwargs={"slug": post.slug}),
            {},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(purchase_response.status_code, 400)
        self.assertEqual(purchase_response.json()["message"], "Password is required.")

    def test_multi_condition_book_requires_password_before_condition_modal(self):
        book = Book.objects.create(
            name="Encrypted points book",
            slug="encrypted-points-book",
            summary="summary",
            visibility=Book.VISIBILITY_CONDITIONAL,
            created_by=self.user,
            condition_rules=[
                {"type": "encrypted", "value": hash_condition_password("first-book-pass")},
                {"type": "points", "value": 10},
            ],
        )
        other_user = User.objects.create_user(username="book-reader", password="login-pass")
        UserProfile.objects.get_or_create(user=other_user)
        self.client.force_login(other_user)

        detail_response = self.client.get(book.get_absolute_url())

        self.assertEqual(detail_response.status_code, 200)
        self.assertContains(detail_response, 'data-encrypted-post-modal')
        self.assertNotContains(detail_response, 'data-conditional-access-modal')

        purchase_response = self.client.post(
            reverse("book-detail", kwargs={"slug": book.slug}),
            {},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(purchase_response.status_code, 400)
        self.assertEqual(purchase_response.json()["message"], "Password is required.")

    def test_book_gate_priority_prefers_book_condition_over_post_password(self):
        post_author = User.objects.create_user(username="nested-author", password="login-pass")
        locked_post = Post.objects.create(
            title="Nested locked post",
            slug="nested-locked-post",
            summary="summary",
            content="secret nested",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_CONDITIONAL,
            author=post_author,
            condition_rules=[{"type": "encrypted", "value": hash_condition_password("nested-pass")}],
        )
        book = Book.objects.create(
            name="Priority book",
            slug="priority-book",
            summary="summary",
            visibility=Book.VISIBILITY_CONDITIONAL,
            created_by=self.user,
            condition_rules=[{"type": "money", "value": 50}],
            structure=[{"type": "post", "post_id": locked_post.pk}],
        )
        other_user = User.objects.create_user(username="priority-reader", password="login-pass")
        UserProfile.objects.get_or_create(user=other_user)
        self.client.force_login(other_user)

        response = self.client.get(f"{book.get_absolute_url()}?post={locked_post.slug}")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-conditional-access-modal')
        self.assertNotContains(response, 'data-encrypted-post-modal')

    def test_book_gate_priority_prefers_post_condition_after_book_passes(self):
        post_author = User.objects.create_user(username="post-condition-author", password="login-pass")
        conditional_post = Post.objects.create(
            title="Nested conditional post",
            slug="nested-conditional-post",
            summary="summary",
            content="conditional nested",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_CONDITIONAL,
            author=post_author,
            condition_rules=[{"type": "points", "value": 10}],
        )
        book = Book.objects.create(
            name="Post condition book",
            slug="post-condition-book",
            summary="summary",
            visibility=Book.VISIBILITY_CONDITIONAL,
            created_by=self.user,
            condition_rules=[{"type": "encrypted", "value": hash_condition_password("book-pass")}],
            structure=[{"type": "post", "post_id": conditional_post.pk}],
        )
        reader = User.objects.create_user(username="post-condition-reader", password="login-pass")
        UserProfile.objects.get_or_create(user=reader)
        self.client.force_login(reader)
        self.client.post(
            reverse("book-detail", kwargs={"slug": book.slug}),
            {"password": "book-pass"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        response = self.client.get(f"{book.get_absolute_url()}?post={conditional_post.slug}")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-conditional-access-modal')
        self.assertContains(response, f'data-conditional-access-url="{conditional_post.get_absolute_url()}?next=', html=False)
        self.assertContains(response, 'nested-conditional-post', html=False)
        self.assertNotContains(response, 'data-encrypted-post-modal')

    def test_encrypted_post_unlock_honors_next_url(self):
        author = User.objects.create_user(username="author", password="login-pass")
        post = Post.objects.create(
            title="Post with next",
            slug="post-with-next",
            summary="summary",
            content="secret",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_CONDITIONAL,
            author=author,
            condition_rules=[{"type": "encrypted", "value": hash_condition_password("next-pass")}],
        )

        response = self.client.post(
            f"{post.get_absolute_url()}?next=/book/demo/?post=post-with-next",
            {"password": "next-pass"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["redirect_url"], "/book/demo/?post=post-with-next")


class BookStructureSyncTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="manager", password="login-pass", is_staff=True)
        self.client.force_login(self.user)

    def test_deleting_post_removes_it_from_book_structure(self):
        post = Post.objects.create(
            title="Chapter post",
            slug="chapter-post",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.user,
        )
        book = Book.objects.create(
            name="Structure book",
            slug="structure-book",
            summary="summary",
            visibility=Book.VISIBILITY_PUBLIC,
            created_by=self.user,
            structure=[
                {
                    "type": "group",
                    "title": "Part 1",
                    "children": [{"type": "post", "post_id": post.pk}],
                }
            ],
        )
        book.posts.add(post)

        response = self.client.post(reverse("manage-post-delete", args=[post.pk]))

        self.assertEqual(response.status_code, 302)
        book.refresh_from_db()
        self.assertEqual(book.structure, [])
        self.assertEqual(book.posts.count(), 0)

    def test_book_form_hides_missing_structure_posts(self):
        book = Book.objects.create(
            name="Broken structure book",
            slug="broken-structure-book",
            summary="summary",
            visibility=Book.VISIBILITY_PUBLIC,
            created_by=self.user,
            structure=[{"type": "post", "post_id": 999999}],
        )

        response = self.client.get(reverse("manage-book-update", args=[book.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, "#999999")
        self.assertContains(response, '<script id="book-structure-data" type="application/json">[]</script>', html=False)

    def test_cloned_revision_keeps_books_but_new_publish_does_not_inherit_books(self):
        source_post = Post.objects.create(
            title="Source post",
            slug="source-post",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.user,
        )
        book = Book.objects.create(
            name="Linked book",
            slug="linked-book",
            summary="summary",
            visibility=Book.VISIBILITY_PUBLIC,
            created_by=self.user,
        )
        source_post.books.add(book)

        revision = clone_post_to_draft(source_post, self.user)
        self.assertEqual(list(revision.books.values_list("pk", flat=True)), [book.pk])

        imported_response = self.client.post(reverse("manage-post-import"), {"source_post_id": source_post.pk})
        self.assertEqual(imported_response.status_code, 302)
        imported_draft = self.user.post_drafts.filter(source_post__isnull=True).latest("pk")
        imported_post = publish_post_draft(imported_draft)

        self.assertEqual(imported_post.books.count(), 0)


class ProfileBookLimitAccessTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="book-owner", password="login-pass")
        self.client.force_login(self.user)
        UserProfile.objects.get_or_create(user=self.user)
        self.site_setting = get_or_create_site_setting()
        self.site_setting.allow_non_admin_create_book = True
        self.site_setting.vip_only_create_book = False
        self.site_setting.non_admin_max_book_count = 1
        self.site_setting.save(
            update_fields=[
                "allow_non_admin_create_book",
                "vip_only_create_book",
                "non_admin_max_book_count",
            ]
        )
        self.book = Book.objects.create(
            name="Owned book",
            slug="owned-book",
            summary="summary",
            visibility=Book.VISIBILITY_PUBLIC,
            created_by=self.user,
        )

    def test_create_view_is_blocked_when_user_reaches_book_limit(self):
        response = self.client.get(reverse("profile-book-create"))

        self.assertEqual(response.status_code, 403)

    def test_update_view_remains_available_when_user_reaches_book_limit(self):
        response = self.client.get(reverse("profile-book-update", args=[self.book.pk]))

        self.assertEqual(response.status_code, 200)

    def test_delete_view_remains_available_when_user_reaches_book_limit(self):
        response = self.client.post(reverse("profile-book-delete", args=[self.book.pk]))

        self.assertRedirects(response, reverse("profile-books"))
        self.assertFalse(Book.objects.filter(pk=self.book.pk).exists())

    def test_book_post_search_remains_available_when_user_reaches_book_limit(self):
        response = self.client.get(reverse("profile-book-post-search"), {"q": "owned"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["ok"], True)


class ProfileBookAccessRuleTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="book-rule-owner", password="login-pass")
        self.reader = User.objects.create_user(username="book-rule-reader", password="login-pass")
        self.client.force_login(self.reader)
        self.profile, _created = UserProfile.objects.get_or_create(user=self.reader)
        self.book = Book.objects.create(
            name="Reader book",
            slug="reader-book",
            summary="summary",
            visibility=Book.VISIBILITY_PUBLIC,
            created_by=self.reader,
        )

    def test_book_only_post_appears_in_profile_book_search(self):
        post = Post.objects.create(
            title="Book only post",
            slug="book-only-post",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_CONDITIONAL,
            author=self.owner,
            condition_rules=[{"type": "book_only"}],
        )

        response = self.client.get(reverse("profile-book-post-search"), {"q": "Book only"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual([item["id"] for item in payload["items"]], [post.pk])
        self.assertFalse(payload["items"][0]["requiresPassword"])
        self.assertFalse(payload["items"][0]["requiresCondition"])

    def test_book_only_post_can_be_saved_into_book(self):
        post = Post.objects.create(
            title="Book only save",
            slug="book-only-save",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_CONDITIONAL,
            author=self.owner,
            condition_rules=[{"type": "book_only"}],
        )

        response = self.client.post(
            reverse("profile-book-update", args=[self.book.pk]),
            {
                "name": self.book.name,
                "slug": self.book.slug,
                "summary": self.book.summary,
                "visibility": self.book.visibility,
                "condition_rules": "[]",
                "structure": '[{"type":"post","post_id":%d}]' % post.pk,
                "post_selection": str(post.pk),
            },
        )

        self.assertEqual(response.status_code, 302)
        self.book.refresh_from_db()
        self.assertEqual(list(self.book.posts.values_list("pk", flat=True)), [post.pk])

    def test_book_only_with_password_and_money_requires_all_conditions_before_save(self):
        post = Post.objects.create(
            title="Book only gated",
            slug="book-only-gated",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_CONDITIONAL,
            author=self.owner,
            condition_rules=[
                {"type": "book_only"},
                {"type": "encrypted", "value": hash_condition_password("gate-pass")},
                {"type": "money", "value": 50},
            ],
        )

        blocked_response = self.client.post(
            reverse("profile-book-update", args=[self.book.pk]),
            {
                "name": self.book.name,
                "slug": self.book.slug,
                "summary": self.book.summary,
                "visibility": self.book.visibility,
                "condition_rules": "[]",
                "structure": '[{"type":"post","post_id":%d}]' % post.pk,
                "post_selection": str(post.pk),
            },
        )

        self.assertEqual(blocked_response.status_code, 200)
        self.assertContains(blocked_response, 'You do not have permission to add "Book only gated" to this book.')

        unlock_response = self.client.post(
            reverse("blog-detail", kwargs={"slug": post.slug}),
            {"password": "gate-pass"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )
        self.assertEqual(unlock_response.status_code, 200)

        still_blocked_response = self.client.post(
            reverse("profile-book-update", args=[self.book.pk]),
            {
                "name": self.book.name,
                "slug": self.book.slug,
                "summary": self.book.summary,
                "visibility": self.book.visibility,
                "condition_rules": "[]",
                "structure": '[{"type":"post","post_id":%d}]' % post.pk,
                "post_selection": str(post.pk),
            },
        )

        self.assertEqual(still_blocked_response.status_code, 200)
        self.assertContains(still_blocked_response, 'You do not have permission to add "Book only gated" to this book.')

        self.profile.money = 100
        self.profile.save(update_fields=["money"])
        purchase_response = self.client.post(
            reverse("blog-detail", kwargs={"slug": post.slug}),
            {},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )
        self.assertEqual(purchase_response.status_code, 200)

        success_response = self.client.post(
            reverse("profile-book-update", args=[self.book.pk]),
            {
                "name": self.book.name,
                "slug": self.book.slug,
                "summary": self.book.summary,
                "visibility": self.book.visibility,
                "condition_rules": "[]",
                "structure": '[{"type":"post","post_id":%d}]' % post.pk,
                "post_selection": str(post.pk),
            },
        )

        self.assertEqual(success_response.status_code, 302)
        self.book.refresh_from_db()
        self.assertEqual(list(self.book.posts.values_list("pk", flat=True)), [post.pk])


class ContentViewTrackingTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(username="tracking-author", password="login-pass")
        self.reader = User.objects.create_user(username="tracking-reader", password="login-pass")
        UserProfile.objects.get_or_create(user=self.reader)
        self.client.force_login(self.reader)

    def test_external_post_visit_counts_toward_dashboard_stats(self):
        post = Post.objects.create(
            title="Shared post",
            slug="shared-post",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.author,
        )
        share_link = PostShareLink.objects.create(post=post, token="post-share-token", created_by=self.author)

        response = self.client.get(reverse("blog-share-detail", kwargs={"token": share_link.token}), REMOTE_ADDR="198.51.100.8")

        self.assertEqual(response.status_code, 200)
        post.refresh_from_db()
        self.assertEqual(post.view_count, 1)
        self.assertEqual(
            ContentViewLog.objects.filter(
                content_type=ContentViewLog.CONTENT_TYPE_POST,
                object_id=post.pk,
                ip_address="198.51.100.8",
            ).count(),
            1,
        )

    def test_same_ip_deduplicates_site_and_external_post_visits(self):
        post = Post.objects.create(
            title="Unified post",
            slug="unified-post",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.author,
        )
        PostShareLink.objects.create(post=post, token="unified-post-share", created_by=self.author)

        first_response = self.client.get(post.get_absolute_url(), REMOTE_ADDR="198.51.100.9")
        second_response = self.client.get(reverse("blog-share-detail", kwargs={"token": "unified-post-share"}), REMOTE_ADDR="198.51.100.9")

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        post.refresh_from_db()
        self.assertEqual(post.view_count, 1)
        self.assertEqual(
            ContentViewLog.objects.filter(
                content_type=ContentViewLog.CONTENT_TYPE_POST,
                object_id=post.pk,
                ip_address="198.51.100.9",
            ).count(),
            1,
        )

    def test_different_logged_in_users_on_same_ip_count_once(self):
        post = Post.objects.create(
            title="IP only post",
            slug="ip-only-post",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.author,
        )
        other_reader = User.objects.create_user(username="tracking-other", password="login-pass")
        UserProfile.objects.get_or_create(user=other_reader)

        self.client.force_login(self.reader)
        first_response = self.client.get(post.get_absolute_url(), REMOTE_ADDR="198.51.100.10")
        self.client.force_login(other_reader)
        second_response = self.client.get(post.get_absolute_url(), REMOTE_ADDR="198.51.100.10")

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        post.refresh_from_db()
        self.assertEqual(post.view_count, 1)
        self.assertEqual(
            ContentViewLog.objects.filter(
                content_type=ContentViewLog.CONTENT_TYPE_POST,
                object_id=post.pk,
                ip_address="198.51.100.10",
            ).count(),
            1,
        )

    def test_external_book_visit_counts_once_per_ip_window(self):
        chapter = Post.objects.create(
            title="Book chapter",
            slug="book-chapter",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.author,
        )
        book = Book.objects.create(
            name="Shared book",
            slug="shared-book",
            summary="summary",
            visibility=Book.VISIBILITY_PUBLIC,
            created_by=self.author,
            structure=[{"type": "post", "post_id": chapter.pk}],
        )
        book.posts.add(chapter)
        BookShareLink.objects.create(book=book, token="shared-book-token", created_by=self.author)

        first_response = self.client.get(reverse("book-share-detail", kwargs={"token": "shared-book-token"}), REMOTE_ADDR="198.51.100.11")
        second_response = self.client.get(reverse("book-share-detail", kwargs={"token": "shared-book-token"}), REMOTE_ADDR="198.51.100.11")

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        book.refresh_from_db()
        self.assertEqual(book.view_count, 1)
        self.assertEqual(
            ContentViewLog.objects.filter(
                content_type=ContentViewLog.CONTENT_TYPE_BOOK,
                object_id=book.pk,
                ip_address="198.51.100.11",
            ).count(),
            1,
        )

    def test_same_ip_can_count_again_after_cooldown_window(self):
        post = Post.objects.create(
            title="Cooldown post",
            slug="cooldown-post",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.author,
        )

        first_response = self.client.get(post.get_absolute_url(), REMOTE_ADDR="198.51.100.12")
        self.assertEqual(first_response.status_code, 200)

        view_log = ContentViewLog.objects.get(content_type=ContentViewLog.CONTENT_TYPE_POST, object_id=post.pk)
        stale_time = timezone.now() - timedelta(minutes=31)
        view_log.viewed_at = stale_time
        view_log.save(update_fields=["viewed_at"])

        second_response = self.client.get(post.get_absolute_url(), REMOTE_ADDR="198.51.100.12")

        self.assertEqual(second_response.status_code, 200)
        post.refresh_from_db()
        self.assertEqual(post.view_count, 2)
        self.assertEqual(
            ContentViewLog.objects.filter(
                content_type=ContentViewLog.CONTENT_TYPE_POST,
                object_id=post.pk,
                ip_address="198.51.100.12",
            ).count(),
            2,
        )


class ManageVisibilitySaveTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="visibility-manager", password="login-pass", is_staff=True)
        self.client.force_login(self.user)

    def test_create_post_allows_public_visibility_with_empty_condition_rules(self):
        response = self.client.post(
            reverse("manage-post-create"),
            {
                "title": "Public draft",
                "slug": "public-draft",
                "summary": "summary",
                "content": "content",
                "status": Post.STATUS_DRAFT,
                "visibility": Post.VISIBILITY_PUBLIC,
                "condition_rules": "[]",
                "tag_names": "",
            },
        )

        self.assertEqual(response.status_code, 302)
        draft = self.user.post_drafts.get(slug="public-draft")
        self.assertEqual(draft.visibility, Post.VISIBILITY_PUBLIC)
        self.assertEqual(draft.condition_rules, [])

    def test_create_post_allows_private_visibility_with_empty_condition_rules(self):
        response = self.client.post(
            reverse("manage-post-create"),
            {
                "title": "Private draft",
                "slug": "private-draft",
                "summary": "summary",
                "content": "content",
                "status": Post.STATUS_DRAFT,
                "visibility": Post.VISIBILITY_PRIVATE,
                "condition_rules": "[]",
                "tag_names": "",
            },
        )

        self.assertEqual(response.status_code, 302)
        draft = self.user.post_drafts.get(slug="private-draft")
        self.assertEqual(draft.visibility, Post.VISIBILITY_PRIVATE)
        self.assertEqual(draft.condition_rules, [])

    def test_create_post_requires_conditions_for_conditional_visibility(self):
        response = self.client.post(
            reverse("manage-post-create"),
            {
                "title": "Conditional draft",
                "slug": "conditional-draft",
                "summary": "summary",
                "content": "content",
                "status": Post.STATUS_DRAFT,
                "visibility": Post.VISIBILITY_CONDITIONAL,
                "condition_rules": "[]",
                "tag_names": "",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "At least one complete condition is required.")
        self.assertFalse(self.user.post_drafts.filter(slug="conditional-draft").exists())

    def test_create_book_allows_public_visibility_with_empty_condition_rules(self):
        response = self.client.post(
            reverse("manage-book-create"),
            {
                "name": "Public book",
                "slug": "public-book",
                "summary": "summary",
                "visibility": Book.VISIBILITY_PUBLIC,
                "condition_rules": "[]",
                "structure": "[]",
            },
        )

        self.assertEqual(response.status_code, 302)
        book = Book.objects.get(slug="public-book")
        self.assertEqual(book.visibility, Book.VISIBILITY_PUBLIC)
        self.assertEqual(book.condition_rules, [])

    def test_create_book_allows_private_visibility_with_empty_condition_rules(self):
        response = self.client.post(
            reverse("manage-book-create"),
            {
                "name": "Private book",
                "slug": "private-book",
                "summary": "summary",
                "visibility": Book.VISIBILITY_PRIVATE,
                "condition_rules": "[]",
                "structure": "[]",
            },
        )

        self.assertEqual(response.status_code, 302)
        book = Book.objects.get(slug="private-book")
        self.assertEqual(book.visibility, Book.VISIBILITY_PRIVATE)
        self.assertEqual(book.condition_rules, [])

    def test_create_book_requires_conditions_for_conditional_visibility(self):
        response = self.client.post(
            reverse("manage-book-create"),
            {
                "name": "Conditional book",
                "slug": "conditional-book",
                "summary": "summary",
                "visibility": Book.VISIBILITY_CONDITIONAL,
                "condition_rules": "[]",
                "structure": "[]",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "At least one complete condition is required.")
        self.assertFalse(Book.objects.filter(slug="conditional-book").exists())
