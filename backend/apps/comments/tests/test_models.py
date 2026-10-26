from django.core.exceptions import ValidationError
from django.test import TestCase

from django.core.files.uploadedfile import SimpleUploadedFile

from apps.comments.models import ArticleComment
from apps.comments.views import sync_comment_assets
from apps.resources.models import MediaAsset, MediaAssetReference
from apps.resources.models import Article
from apps.users.models import User


class ArticleCommentModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="reader", password="password123")
        self.article = Article.objects.create(title="Article", slug="article", author=self.user)

    def test_replies_cannot_use_another_reply_as_parent(self):
        root = ArticleComment.objects.create(article=self.article, author=self.user, content="Root")
        reply = ArticleComment.objects.create(article=self.article, author=self.user, parent=root, reply_to=root, content="Reply")
        nested = ArticleComment(article=self.article, author=self.user, parent=reply, reply_to=reply, content="Invalid")
        with self.assertRaises(ValidationError):
            nested.clean()

    def test_sync_comment_assets_replaces_comment_references(self):
        first = MediaAsset.objects.create(
            kind=MediaAsset.KIND_IMAGE,
            file=SimpleUploadedFile("first.png", b"image", content_type="image/png"),
            original_filename="first.png",
            uploaded_by=self.user,
        )
        second = MediaAsset.objects.create(
            kind=MediaAsset.KIND_IMAGE,
            file=SimpleUploadedFile("second.png", b"image", content_type="image/png"),
            original_filename="second.png",
            uploaded_by=self.user,
        )
        comment = ArticleComment.objects.create(
            article=self.article,
            author=self.user,
            content=f'::image{{assetId="{first.pk}"}}',
        )

        sync_comment_assets(comment, self.user)
        self.assertTrue(MediaAssetReference.objects.filter(
            asset=first,
            resource_type="comment",
            resource_id=comment.pk,
        ).exists())

        comment.content = f'::image{{assetId="{second.pk}"}}'
        sync_comment_assets(comment, self.user)
        self.assertFalse(MediaAssetReference.objects.filter(
            asset=first,
            resource_type="comment",
            resource_id=comment.pk,
        ).exists())
        self.assertTrue(MediaAssetReference.objects.filter(
            asset=second,
            resource_type="comment",
            resource_id=comment.pk,
        ).exists())
