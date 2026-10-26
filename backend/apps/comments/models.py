from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class ArticleComment(models.Model):
    article = models.ForeignKey("resources.Article", on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="article_comments")
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="replies")
    reply_to = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    content = models.TextField()
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "article_comments"
        ordering = ("created_at", "pk")
        indexes = [
            models.Index(fields=("article", "parent", "created_at", "id"), name="article_comment_thread_idx"),
            models.Index(fields=("author", "created_at"), name="article_comment_author_idx"),
        ]

    def clean(self):
        if self.parent_id is None:
            if self.reply_to_id is not None:
                raise ValidationError("Root comments cannot have a reply target.")
            return
        if self.parent.parent_id is not None or self.parent.article_id != self.article_id:
            raise ValidationError("Replies must belong to a root comment on the same article.")
        if self.reply_to_id and (
            self.reply_to.article_id != self.article_id
            or (self.reply_to_id != self.parent_id and self.reply_to.parent_id != self.parent_id)
        ):
            raise ValidationError("Reply target must belong to the same comment thread.")


class CommentReaction(models.Model):
    VOTE_UP = "up"
    VOTE_DOWN = "down"
    VOTE_CHOICES = ((VOTE_UP, "Up"), (VOTE_DOWN, "Down"))

    comment = models.ForeignKey(ArticleComment, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="article_comment_reactions")
    vote = models.CharField(max_length=4, choices=VOTE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "article_comment_reactions"
        constraints = [models.UniqueConstraint(fields=("comment", "user"), name="comment_reaction_user_unique")]
        indexes = [models.Index(fields=("comment", "vote"), name="comment_reaction_count_idx")]
