from datetime import timedelta

from django.contrib.auth.models import Group
from django.contrib.auth import get_user_model
from django.contrib.messages import get_messages
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from decimal import Decimal

from apps.blog.models import Attachment, AuthorRewardRecord, Book, BookShareLink, Comment, CommentRewardRecord, ContentViewLog, Post, PostShareLink, UserMoneyHistory, UserPointsHistory
from apps.blog.utils import get_or_create_site_setting, set_settings
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
        self.assertContains(detail_response, 'data-gate-password-form')
        self.assertNotContains(detail_response, 'data-conditional-access-modal')

        purchase_response = self.client.post(
            reverse("blog-detail", kwargs={"slug": post.slug}),
            {},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(purchase_response.status_code, 200)
        self.assertEqual(purchase_response.json()["message"], "Password is required.")
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
        self.assertContains(detail_response, 'data-gate-password-form')
        self.assertNotContains(detail_response, 'data-conditional-access-modal')

        purchase_response = self.client.post(
            reverse("book-detail", kwargs={"slug": book.slug}),
            {},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

        self.assertEqual(purchase_response.status_code, 200)
        self.assertEqual(purchase_response.json()["message"], "Password is required.")
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
        self.assertContains(response, 'data-gate-table-wrapper')
        self.assertNotContains(response, 'data-gate-password-form')

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
        self.assertContains(response, 'data-gate-table-wrapper')
        self.assertContains(response, f'data-conditional-access-url="{conditional_post.get_absolute_url()}?next=', html=False)
        self.assertContains(response, 'nested-conditional-post', html=False)
        self.assertNotContains(response, 'data-gate-password-form')

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


class AuthorRewardFlowTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(username="reward-author", password="login-pass")
        self.reader = User.objects.create_user(username="reward-reader", password="login-pass")
        self.vip_reader = User.objects.create_user(username="reward-vip-reader", password="login-pass")
        UserProfile.objects.get_or_create(user=self.author)
        UserProfile.objects.get_or_create(user=self.reader)
        UserProfile.objects.get_or_create(user=self.vip_reader)
        vip_group, _created = Group.objects.get_or_create(name="vip_1")
        self.vip_reader.groups.add(vip_group)
        self.client.force_login(self.reader)
        set_settings(
            {
                "article_author_reward_money_ratio": Decimal("0.80"),
                "article_author_reward_points_ratio": Decimal("0.00"),
                "book_author_reward_money_ratio": Decimal("0.80"),
                "book_author_reward_points_ratio": Decimal("0.00"),
                "attachment_author_reward_money_ratio": Decimal("0.80"),
                "attachment_author_reward_points_ratio": Decimal("0.00"),
                "vip_max_level": 1,
                "vip_configs": [{"display_name": "VIP 1", "money_discount": "0.10", "points_discount": "0.05"}],
            }
        )

    def test_first_post_access_rewards_author_money_once(self):
        post = Post.objects.create(
            title="Rewarded post",
            slug="rewarded-post",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_CONDITIONAL,
            author=self.author,
            condition_rules=[{"type": "money", "value": 5}],
        )
        self.reader.profile.money = 20
        self.reader.profile.save(update_fields=["money"])
        self.client.post(reverse("access-check", kwargs={"object_type": "post", "object_id": post.pk}), {"action": "purchase"})

        first_response = self.client.get(post.get_absolute_url())
        second_response = self.client.get(post.get_absolute_url())

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.author.profile.refresh_from_db()
        self.assertEqual(self.author.profile.money, 4)
        self.assertEqual(self.author.profile.points, 0)
        self.assertEqual(AuthorRewardRecord.objects.filter(object_type="post", object_id=post.pk, reader=self.reader).count(), 1)
        record = UserMoneyHistory.objects.get(user=self.author, reason_type=UserMoneyHistory.REASON_AUTHOR_REWARD)
        self.assertEqual(record.change_amount, 4)
        self.assertEqual(record.balance_after, 4)

    def test_first_book_access_rewards_author_points_with_rounding_up(self):
        set_settings({"book_author_reward_money_ratio": Decimal("0.00"), "book_author_reward_points_ratio": Decimal("0.10")})
        book = Book.objects.create(
            name="Rewarded book",
            slug="rewarded-book",
            summary="summary",
            visibility=Book.VISIBILITY_CONDITIONAL,
            created_by=self.author,
            condition_rules=[{"type": "points", "value": 1}],
        )
        self.reader.profile.points = 5
        self.reader.profile.save(update_fields=["points"])

        response = self.client.get(book.get_absolute_url())

        self.assertEqual(response.status_code, 200)
        self.author.profile.refresh_from_db()
        self.assertEqual(self.author.profile.money, 0)
        self.assertEqual(self.author.profile.points, 1)
        record = AuthorRewardRecord.objects.get(object_type="book", object_id=book.pk, reader=self.reader)
        self.assertEqual(record.reward_points, 1)
        points_history = UserPointsHistory.objects.get(user=self.author, reason_type=UserPointsHistory.REASON_AUTHOR_REWARD)
        self.assertEqual(points_history.change_amount, 1)
        self.assertEqual(points_history.balance_after, 1)

    def test_attachment_download_rewards_author_for_money_and_points_once(self):
        set_settings({"attachment_author_reward_money_ratio": Decimal("0.50"), "attachment_author_reward_points_ratio": Decimal("0.25")})
        attachment = Attachment.objects.create(
            title="Rewarded attachment",
            original_filename="rewarded.txt",
            mime_type="text/plain",
            file_size=12,
            file_ext="txt",
            visibility=Attachment.VISIBILITY_CONDITIONAL,
            condition_rules=[{"type": "money", "value": 5}, {"type": "points", "value": 3}],
            uploaded_by=self.author,
            file=SimpleUploadedFile("rewarded.txt", b"rewarded-file", content_type="text/plain"),
        )
        self.reader.profile.money = 20
        self.reader.profile.points = 20
        self.reader.profile.save(update_fields=["money", "points"])
        self.client.post(reverse("attachment-access-check", kwargs={"pk": attachment.pk}), {"action": "purchase"})

        first_response = self.client.get(reverse("attachment-download", kwargs={"pk": attachment.pk}))
        second_response = self.client.get(reverse("attachment-download", kwargs={"pk": attachment.pk}))

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.author.profile.refresh_from_db()
        self.assertEqual(self.author.profile.money, 3)
        self.assertEqual(self.author.profile.points, 1)
        record = AuthorRewardRecord.objects.get(object_type="attachment", object_id=attachment.pk, reader=self.reader)
        self.assertEqual(record.reward_money, 3)
        self.assertEqual(record.reward_points, 1)

    def test_author_visiting_own_content_does_not_create_reward(self):
        self.client.force_login(self.author)
        post = Post.objects.create(
            title="Own post",
            slug="own-post",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_CONDITIONAL,
            author=self.author,
            condition_rules=[{"type": "points", "value": 4}],
        )
        self.author.profile.points = 10
        self.author.profile.save(update_fields=["points"])

        response = self.client.get(post.get_absolute_url())

        self.assertEqual(response.status_code, 200)
        self.assertFalse(AuthorRewardRecord.objects.filter(object_type="post", object_id=post.pk).exists())

    def test_first_standalone_post_access_rewards_vip_author_based_on_vip_rules(self):
        set_settings({"article_author_reward_money_ratio": Decimal("0.50"), "article_author_reward_points_ratio": Decimal("0.50")})
        post = Post.objects.create(
            title="VIP rewarded post",
            slug="vip-rewarded-post",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_CONDITIONAL,
            access_scope=Post.ACCESS_SCOPE_STANDALONE,
            vip_access_permission=Post.VISIBILITY_CONDITIONAL,
            author=self.author,
            condition_rules=[{"type": "money", "value": 10}],
            vip_condition_rules=[{"type": "points", "value": 1}],
        )
        self.vip_reader.profile.points = 5
        self.vip_reader.profile.save(update_fields=["points"])

        self.client.force_login(self.vip_reader)
        response = self.client.get(post.get_absolute_url())

        self.assertEqual(response.status_code, 200)
        self.author.profile.refresh_from_db()
        self.assertEqual(self.author.profile.money, 0)
        self.assertEqual(self.author.profile.points, 1)
        record = AuthorRewardRecord.objects.get(object_type="post", object_id=post.pk, reader=self.vip_reader)
        self.assertEqual(record.reward_money, 0)
        self.assertEqual(record.reward_points, 1)

    def test_first_standalone_book_access_with_vip_public_does_not_reward_author(self):
        book = Book.objects.create(
            name="VIP public rewarded book",
            slug="vip-public-rewarded-book",
            summary="summary",
            visibility=Book.VISIBILITY_CONDITIONAL,
            access_scope=Book.ACCESS_SCOPE_STANDALONE,
            vip_access_permission=Book.VISIBILITY_PUBLIC,
            created_by=self.author,
            condition_rules=[{"type": "money", "value": 10}],
        )
        self.vip_reader.profile.money = 20
        self.vip_reader.profile.save(update_fields=["money"])

        self.client.force_login(self.vip_reader)
        response = self.client.get(book.get_absolute_url())

        self.assertEqual(response.status_code, 200)
        self.author.profile.refresh_from_db()
        self.assertEqual(self.author.profile.money, 0)
        self.assertEqual(self.author.profile.points, 0)
        self.assertFalse(AuthorRewardRecord.objects.filter(object_type="book", object_id=book.pk, reader=self.vip_reader).exists())

    def test_vip_money_discount_applies_outside_standalone_scope(self):
        post = Post.objects.create(
            title="Discounted post",
            slug="discounted-post",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_CONDITIONAL,
            author=self.author,
            condition_rules=[{"type": "money", "value": 100}],
        )
        self.vip_reader.profile.money = 90
        self.vip_reader.profile.save(update_fields=["money"])
        self.client.force_login(self.vip_reader)

        check = self.client.get(reverse("access-check", kwargs={"object_type": "post", "object_id": post.pk})).json()

        self.assertEqual(check["conditions"][0]["requirement"], "90")
        self.assertTrue(check["conditions"][0]["discount_applied"])
        purchase_response = self.client.post(reverse("access-check", kwargs={"object_type": "post", "object_id": post.pk}), {"action": "purchase"})
        self.assertEqual(purchase_response.status_code, 200)
        self.vip_reader.profile.refresh_from_db()
        self.assertEqual(self.vip_reader.profile.money, 0)
        record = UserMoneyHistory.objects.get(user=self.vip_reader, reason_type=UserMoneyHistory.REASON_CONTENT_PURCHASE)
        self.assertEqual(record.change_amount, -90)
        self.assertEqual(record.balance_after, 0)

    def test_vip_points_discount_applies_outside_standalone_scope(self):
        post = Post.objects.create(
            title="Discounted points post",
            slug="discounted-points-post",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_CONDITIONAL,
            author=self.author,
            condition_rules=[{"type": "points", "value": 100}],
        )
        self.vip_reader.profile.points = 95
        self.vip_reader.profile.save(update_fields=["points"])
        self.client.force_login(self.vip_reader)

        check = self.client.get(reverse("access-check", kwargs={"object_type": "post", "object_id": post.pk})).json()

        self.assertEqual(check["conditions"][0]["requirement"], "95")
        self.assertTrue(check["all_granted"])

    def test_first_standalone_attachment_access_non_vip_still_rewards_from_common_rules(self):
        set_settings({"attachment_author_reward_money_ratio": Decimal("0.50"), "attachment_author_reward_points_ratio": Decimal("0.50")})
        attachment = Attachment.objects.create(
            title="Standalone rewarded attachment",
            original_filename="standalone-rewarded.txt",
            mime_type="text/plain",
            file_size=12,
            file_ext="txt",
            visibility=Attachment.VISIBILITY_CONDITIONAL,
            access_scope=Attachment.ACCESS_SCOPE_STANDALONE,
            vip_access_permission=Attachment.VISIBILITY_PUBLIC,
            condition_rules=[{"type": "money", "value": 5}, {"type": "points", "value": 3}],
            uploaded_by=self.author,
            file=SimpleUploadedFile("standalone-rewarded.txt", b"rewarded-file", content_type="text/plain"),
        )
        self.reader.profile.money = 20
        self.reader.profile.points = 20
        self.reader.profile.save(update_fields=["money", "points"])
        self.client.force_login(self.reader)
        self.client.post(reverse("attachment-access-check", kwargs={"pk": attachment.pk}), {"action": "purchase"})

        response = self.client.get(reverse("attachment-download", kwargs={"pk": attachment.pk}))

        self.assertEqual(response.status_code, 200)
        self.author.profile.refresh_from_db()
        self.assertEqual(self.author.profile.money, 3)
        self.assertEqual(self.author.profile.points, 2)
        record = AuthorRewardRecord.objects.get(object_type="attachment", object_id=attachment.pk, reader=self.reader)
        self.assertEqual(record.reward_money, 3)
        self.assertEqual(record.reward_points, 2)


class CommentRewardFlowTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(username="comment-author", password="login-pass")
        self.reader = User.objects.create_user(username="comment-reader", password="login-pass")
        UserProfile.objects.get_or_create(user=self.author)
        UserProfile.objects.get_or_create(user=self.reader)
        self.client.force_login(self.reader)
        set_settings({"allow_user_comment": True, "comment_first_reward_money": 1, "comment_first_reward_points": 1})

    def test_first_comment_rewards_user_once_on_post(self):
        post = Post.objects.create(
            title="Comment reward post",
            slug="comment-reward-post",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.author,
        )

        first_response = self.client.post(reverse("comment-create", kwargs={"slug": post.slug}), {"content": "first comment"})
        second_response = self.client.post(reverse("comment-create", kwargs={"slug": post.slug}), {"content": "second comment"})

        self.assertEqual(first_response.status_code, 302)
        self.assertEqual(second_response.status_code, 302)
        self.reader.profile.refresh_from_db()
        self.assertEqual(self.reader.profile.money, 1)
        self.assertEqual(self.reader.profile.points, 1)
        record = UserMoneyHistory.objects.get(user=self.reader, reason_type=UserMoneyHistory.REASON_FIRST_COMMENT_REWARD)
        self.assertEqual(record.change_amount, 1)
        self.assertEqual(record.balance_after, 1)
        points_history = UserPointsHistory.objects.get(user=self.reader, reason_type=UserPointsHistory.REASON_FIRST_COMMENT_REWARD)
        self.assertEqual(points_history.change_amount, 1)
        self.assertEqual(points_history.balance_after, 1)


class CommentVipBadgeRenderingTests(TestCase):
    def setUp(self):
        set_settings(
            {
                "allow_user_comment": True,
                "vip_max_level": 2,
                "vip_configs": [
                    {"display_name": "Silver", "money_discount": "0.10", "points_discount": "0.05", "daily_login_bonus_money": 5, "daily_login_bonus_points": 5, "first_comment_bonus_money": 2, "first_comment_bonus_points": 2},
                    {"display_name": "Gold", "money_discount": "0.20", "points_discount": "0.10", "daily_login_bonus_money": 10, "daily_login_bonus_points": 10, "first_comment_bonus_money": 4, "first_comment_bonus_points": 4},
                ],
            }
        )
        self.viewer = User.objects.create_user(username="comment-viewer", password="login-pass")
        self.post_author = User.objects.create_user(username="comment-post-author", password="login-pass")
        self.admin_vip = User.objects.create_superuser(username="comment-admin-vip", email="admin-vip@example.com", password="login-pass")
        UserProfile.objects.get_or_create(user=self.viewer)
        UserProfile.objects.get_or_create(user=self.post_author)
        UserProfile.objects.get_or_create(user=self.admin_vip)
        self.admin_vip.groups.add(Group.objects.get_or_create(name="vip_2")[0])
        self.client.force_login(self.viewer)

    def test_blog_detail_comment_shows_admin_and_vip_labels(self):
        post = Post.objects.create(
            title="Admin VIP comment post",
            slug="admin-vip-comment-post",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.post_author,
        )
        Comment.objects.create(post=post, author=self.admin_vip, content="admin vip comment")

        response = self.client.get(reverse("blog-detail", kwargs={"slug": post.slug}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Administrator")
        self.assertContains(response, "Gold")
        self.assertContains(response, "comment-role-tag-vip")

    def test_blog_detail_comment_shows_vip_label_for_admin_author(self):
        self.admin_vip.first_name = "administrator"
        self.admin_vip.save(update_fields=["first_name"])
        post = Post.objects.create(
            title="Admin VIP author post",
            slug="admin-vip-author-post",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.admin_vip,
        )
        Comment.objects.create(post=post, author=self.admin_vip, content="admin vip author comment")

        response = self.client.get(reverse("blog-detail", kwargs={"slug": post.slug}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "comment-role-tag-author")
        self.assertContains(response, "Administrator")
        self.assertContains(response, "Gold")
        self.assertContains(response, "comment-role-tag-vip")
        self.assertEqual(CommentRewardRecord.objects.filter(user=self.reader, post=post).count(), 1)

    def test_vip_first_comment_adds_extra_rewards(self):
        set_settings(
            {
                "allow_user_comment": True,
                "comment_first_reward_money": 1,
                "comment_first_reward_points": 1,
                "vip_max_level": 2,
                "vip_configs": [
                    {"display_name": "VIP 1", "money_discount": "0.10", "points_discount": "0.05", "daily_login_bonus_money": 5, "daily_login_bonus_points": 5, "first_comment_bonus_money": 2, "first_comment_bonus_points": 2},
                    {"display_name": "VIP 2", "money_discount": "0.20", "points_discount": "0.10", "daily_login_bonus_money": 10, "daily_login_bonus_points": 10, "first_comment_bonus_money": 4, "first_comment_bonus_points": 4},
                ],
            }
        )
        self.reader.groups.add(Group.objects.get_or_create(name="vip_2")[0])
        post = Post.objects.create(
            title="VIP comment reward post",
            slug="vip-comment-reward-post",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.author,
        )

        response = self.client.post(reverse("comment-create", kwargs={"slug": post.slug}), {"content": "vip first comment"})

        self.assertEqual(response.status_code, 302)
        self.reader.profile.refresh_from_db()
        self.assertEqual(self.reader.profile.money, 5)
        self.assertEqual(self.reader.profile.points, 5)
        record = CommentRewardRecord.objects.get(user=self.reader, post=post)
        self.assertEqual(record.reward_money, 5)
        self.assertEqual(record.reward_points, 5)
        message_texts = [message.message for message in get_messages(response.wsgi_request)]
        self.assertIn(
            "Comment posted successfully. First comment reward: +5 money, +5 points. Base: +1 money, +1 points; VIP 2 bonus: +4 money, +4 points.",
            message_texts,
        )

    def test_first_reply_also_counts_for_reward(self):
        post = Post.objects.create(
            title="Reply reward post",
            slug="reply-reward-post",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.author,
        )
        parent_author = User.objects.create_user(username="parent-author", password="login-pass")
        UserProfile.objects.get_or_create(user=parent_author)
        parent_comment = Comment.objects.create(post=post, author=parent_author, content="parent")

        response = self.client.post(reverse("comment-create", kwargs={"slug": post.slug}), {"reply-%s-content" % parent_comment.pk: "reply", "parent_id": str(parent_comment.pk)})

        self.assertEqual(response.status_code, 302)
        self.reader.profile.refresh_from_db()
        self.assertEqual(self.reader.profile.money, 1)
        self.assertEqual(self.reader.profile.points, 1)
        record = CommentRewardRecord.objects.get(user=self.reader, post=post)
        self.assertEqual(record.comment.parent_id, parent_comment.pk)

    def test_book_embedded_post_comment_rewards_user(self):
        post = Post.objects.create(
            title="Book comment post",
            slug="book-comment-post",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.author,
        )
        book = Book.objects.create(
            name="Comment reward book",
            slug="comment-reward-book",
            summary="summary",
            visibility=Book.VISIBILITY_PUBLIC,
            created_by=self.author,
            structure=[{"type": "post", "post_id": post.pk}],
        )

        response = self.client.post(
            f"{reverse('comment-create', kwargs={'slug': post.slug})}?next={book.get_absolute_url()}?post={post.slug}",
            {"content": "book comment"},
        )

        self.assertEqual(response.status_code, 302)
        self.reader.profile.refresh_from_db()
        self.assertEqual(self.reader.profile.money, 1)
        self.assertEqual(self.reader.profile.points, 1)
        self.assertTrue(CommentRewardRecord.objects.filter(user=self.reader, post=post).exists())

    def test_zero_reward_settings_skip_reward_record(self):
        set_settings({"allow_user_comment": True, "comment_first_reward_money": 0, "comment_first_reward_points": 0})
        post = Post.objects.create(
            title="Zero reward post",
            slug="zero-reward-post",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.author,
        )

        response = self.client.post(reverse("comment-create", kwargs={"slug": post.slug}), {"content": "first comment"})

        self.assertEqual(response.status_code, 302)
        self.reader.profile.refresh_from_db()
        self.assertEqual(self.reader.profile.money, 0)
        self.assertEqual(self.reader.profile.points, 0)
        self.assertFalse(CommentRewardRecord.objects.filter(user=self.reader, post=post).exists())

    def test_vip_bonus_can_reward_when_base_first_comment_reward_is_zero(self):
        set_settings(
            {
                "allow_user_comment": True,
                "comment_first_reward_money": 0,
                "comment_first_reward_points": 0,
                "vip_max_level": 1,
                "vip_configs": [
                    {"display_name": "VIP 1", "money_discount": "0.10", "points_discount": "0.05", "daily_login_bonus_money": 5, "daily_login_bonus_points": 5, "first_comment_bonus_money": 2, "first_comment_bonus_points": 2}
                ],
            }
        )
        self.reader.groups.add(Group.objects.get_or_create(name="vip_1")[0])
        post = Post.objects.create(
            title="VIP zero base reward post",
            slug="vip-zero-base-reward-post",
            summary="summary",
            content="content",
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.author,
        )

        response = self.client.post(reverse("comment-create", kwargs={"slug": post.slug}), {"content": "vip bonus comment"})

        self.assertEqual(response.status_code, 302)
        self.reader.profile.refresh_from_db()
        self.assertEqual(self.reader.profile.money, 2)
        self.assertEqual(self.reader.profile.points, 2)
        record = CommentRewardRecord.objects.get(user=self.reader, post=post)
        self.assertEqual(record.reward_money, 2)
        self.assertEqual(record.reward_points, 2)


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
        set_settings(
            {
                "allow_non_admin_create_book": True,
                "vip_only_create_book": False,
                "non_admin_max_book_count": 1,
            }
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
        set_settings({"allow_non_admin_create_book": True})
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

    def test_dashboard_content_snapshot_shows_attachment_count(self):
        Attachment.objects.create(
            title="Dashboard attachment",
            original_filename="dashboard.pdf",
            mime_type="application/pdf",
            file_size=256,
            file_ext="pdf",
            visibility=Attachment.VISIBILITY_PUBLIC,
            uploaded_by=self.author,
            file=SimpleUploadedFile("dashboard.pdf", b"%PDF-dashboard", content_type="application/pdf"),
        )

        response = self.client.get(reverse("dashboard"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Attachments")
        self.assertContains(response, '<strong class="stat-value">1</strong>', html=False)

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

    def test_external_post_only_renders_public_attachments_and_allows_download(self):
        public_attachment = Attachment.objects.create(
            title="Shared public attachment",
            original_filename="shared-public.txt",
            mime_type="text/plain",
            file_size=12,
            file_ext="txt",
            visibility=Attachment.VISIBILITY_PUBLIC,
            uploaded_by=self.author,
            file=SimpleUploadedFile("shared-public.txt", b"public-share", content_type="text/plain"),
        )
        conditional_attachment = Attachment.objects.create(
            title="Shared conditional attachment",
            original_filename="shared-conditional.txt",
            mime_type="text/plain",
            file_size=17,
            file_ext="txt",
            visibility=Attachment.VISIBILITY_CONDITIONAL,
            condition_rules=[{"type": "encrypted", "value": hash_condition_password("hidden-pass")}],
            uploaded_by=self.author,
            file=SimpleUploadedFile("shared-conditional.txt", b"conditional-share", content_type="text/plain"),
        )
        post = Post.objects.create(
            title="Shared post with attachments",
            slug="shared-post-attachments",
            summary="summary",
            content="{{attachment:%d}}\n\n{{attachment:%d}}" % (public_attachment.pk, conditional_attachment.pk),
            status=Post.STATUS_PUBLISHED,
            visibility=Post.VISIBILITY_PUBLIC,
            author=self.author,
        )
        share_link = PostShareLink.objects.create(post=post, token="shared-post-attachments-token", created_by=self.author)

        self.client.logout()
        response = self.client.get(reverse("blog-share-detail", kwargs={"token": share_link.token}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Shared public attachment")
        self.assertNotContains(response, "Shared conditional attachment")
        self.assertContains(response, reverse("attachment-download", kwargs={"pk": public_attachment.pk}))
        self.assertNotContains(response, "js-access-gate-link")

        download_response = self.client.get(reverse("attachment-download", kwargs={"pk": public_attachment.pk}))
        self.assertEqual(download_response.status_code, 200)

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


class ManagePostListViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="post-manager", password="login-pass", is_staff=True)
        self.client.force_login(self.user)
        set_settings({"allow_non_admin_create_post": False})

    def test_new_article_button_is_visible_for_admin_when_non_admin_creation_disabled(self):
        response = self.client.get(reverse("manage-posts"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("manage-post-create"))
        self.assertContains(response, "新建文章")
