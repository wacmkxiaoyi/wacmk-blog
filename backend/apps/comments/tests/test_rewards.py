from django.contrib.auth.models import Group
from django.core.cache import cache
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.comments.models import ArticleComment
from apps.resources.models import Article, MediaAsset
from apps.site_settings.models import SiteSetting
from apps.users.models import User, UserMoneyChangeLog, UserPointsChangeLog


class FirstCommentRewardApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.author = User.objects.create_user(
            username="author", email="author@example.com", password="password123",
        )
        self.reader = User.objects.create_user(
            username="reader", email="reader@example.com", password="password123",
        )
        self.article = Article.objects.create(
            title="Article", slug="article", author=self.author,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.reader)
        SiteSetting.objects.create(
            key="comment",
            value={
                "allow_user_comment": True,
                "vip_only": False,
                "first_reward_money": 3,
                "first_reward_points": 5,
            },
        )

    def post_comment(self, slug="article", **payload):
        return self.client.post(
            f"/api/resources/articles/{slug}/comments/",
            {"content": "Comment", **payload},
            format="json",
        )

    def test_first_comment_awards_site_and_vip_rewards(self):
        Group.objects.create(name="vip_1").user_set.add(self.reader)
        SiteSetting.objects.create(
            key="vip",
            value={
                "vip_max_level": 1,
                "vip_configs": [{
                    "display_name": "VIP 1",
                    "money_discount": "0.10",
                    "points_discount": "0.05",
                    "money_reward": "0.10",
                    "points_reward": "0.05",
                    "daily_login_bonus_money": 5,
                    "daily_login_bonus_points": 5,
                    "first_comment_bonus_money": 7,
                    "first_comment_bonus_points": 11,
                }],
            },
        )
        cache.clear()

        response = self.post_comment()

        self.assertEqual(response.status_code, 201)
        comment = ArticleComment.objects.get()
        self.reader.refresh_from_db()
        self.assertEqual(self.reader.money_balance, 10)
        self.assertEqual(self.reader.points_balance, 16)
        money_entry = UserMoneyChangeLog.objects.get(user=self.reader)
        points_entry = UserPointsChangeLog.objects.get(user=self.reader)
        self.assertEqual(money_entry.reason_type, UserMoneyChangeLog.REASON_FIRST_COMMENT_REWARD)
        self.assertEqual(money_entry.related_object_type, "comment")
        self.assertEqual(money_entry.related_object_id, comment.pk)
        self.assertEqual(points_entry.reason_type, UserPointsChangeLog.REASON_FIRST_COMMENT_REWARD)
        self.assertEqual(points_entry.related_object_id, comment.pk)

    def test_only_the_users_first_comment_on_an_article_is_rewarded(self):
        self.assertEqual(self.post_comment().status_code, 201)
        self.assertEqual(self.post_comment().status_code, 201)

        self.reader.refresh_from_db()
        self.assertEqual(self.reader.money_balance, 3)
        self.assertEqual(self.reader.points_balance, 5)
        self.assertEqual(UserMoneyChangeLog.objects.filter(user=self.reader).count(), 1)
        self.assertEqual(UserPointsChangeLog.objects.filter(user=self.reader).count(), 1)

    def test_first_reply_is_rewarded_when_another_user_started_the_thread(self):
        root = ArticleComment.objects.create(
            article=self.article, author=self.author, content="Root",
        )

        response = self.post_comment(parentId=root.pk, replyToId=root.pk)

        self.assertEqual(response.status_code, 201)
        self.reader.refresh_from_db()
        self.assertEqual(self.reader.money_balance, 3)
        self.assertEqual(self.reader.points_balance, 5)

    def test_first_comments_on_different_articles_are_each_rewarded(self):
        other_article = Article.objects.create(
            title="Other", slug="other", author=self.author,
        )

        self.assertEqual(self.post_comment().status_code, 201)
        self.assertEqual(self.post_comment(other_article.slug).status_code, 201)

        self.reader.refresh_from_db()
        self.assertEqual(self.reader.money_balance, 6)
        self.assertEqual(self.reader.points_balance, 10)

    def test_existing_soft_deleted_comment_prevents_another_reward(self):
        ArticleComment.objects.create(
            article=self.article,
            author=self.reader,
            content="Deleted comment",
            is_deleted=True,
        )

        response = self.post_comment()

        self.assertEqual(response.status_code, 201)
        self.reader.refresh_from_db()
        self.assertEqual(self.reader.money_balance, 0)
        self.assertEqual(self.reader.points_balance, 0)
        self.assertFalse(UserMoneyChangeLog.objects.filter(user=self.reader).exists())
        self.assertFalse(UserPointsChangeLog.objects.filter(user=self.reader).exists())

    def test_comment_media_is_moved_to_the_article_directory(self):
        upload = self.client.post(
            "/api/resources/media/image/",
            {"image": SimpleUploadedFile("comment.png", b"image", content_type="image/png")},
            format="multipart",
        )
        self.assertEqual(upload.status_code, 201)
        asset = MediaAsset.objects.get(pk=upload.data["assetId"])

        response = self.post_comment(content=f'::image{{assetId="{asset.pk}"}}')

        self.assertEqual(response.status_code, 201)
        asset.refresh_from_db()
        expected_key = f"content-assets/user-{self.author.pk}/articles/{self.article.pk}/{asset.pk}"
        self.assertEqual(asset.storage_key, expected_key)
        self.assertTrue(default_storage.exists(expected_key))
