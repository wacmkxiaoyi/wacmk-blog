from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from .base import TimeStampedModel


class Comment(TimeStampedModel):
    post = models.ForeignKey("blog.Post", on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comments")
    parent = models.ForeignKey("self", on_delete=models.CASCADE, blank=True, null=True, related_name="replies")
    reply_to = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name="direct_replies",
    )
    content = models.TextField()

    class Meta:
        ordering = ["created_at", "pk"]
        indexes = [
            models.Index(fields=["post", "created_at"]),
            models.Index(fields=["parent", "created_at"]),
            models.Index(fields=["reply_to", "created_at"]),
        ]

    def __str__(self):
        return f"Comment #{self.pk} on {self.post}"

    def clean(self):
        super().clean()
        if self.parent_id is None:
            if self.reply_to_id is not None:
                raise ValidationError({"reply_to": _("Top-level comments cannot reply to another comment.")})
            return
        if self.parent.post_id != self.post_id:
            raise ValidationError({"parent": _("Comment parent must belong to the same post.")})
        if self.parent.parent_id is not None:
            raise ValidationError({"parent": _("Replies must stay under a top-level comment.")})
        if self.reply_to_id is None:
            raise ValidationError({"reply_to": _("Replies must target a comment.")})
        if self.reply_to.post_id != self.post_id:
            raise ValidationError({"reply_to": _("Reply target must belong to the same post.")})
        if self.reply_to_id != self.parent_id and self.reply_to.parent_id != self.parent_id:
            raise ValidationError({"reply_to": _("Replies can only target the top-level comment or one of its direct replies.")})

    @property
    def is_reply(self):
        return self.parent_id is not None


class CommentFeedback(TimeStampedModel):
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, related_name="feedback_entries")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comment_feedback_entries")
    value = models.SmallIntegerField(validators=[MinValueValidator(-1), MaxValueValidator(1)])

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["comment", "user"], name="blog_commentfeedback_comment_user_unique"),
        ]
        indexes = [
            models.Index(fields=["comment", "value"]),
            models.Index(fields=["user", "value"]),
        ]

    def __str__(self):
        return f"Comment feedback {self.value} for {self.comment_id} by {self.user_id}"

    def clean(self):
        super().clean()
        if self.value not in {-1, 1}:
            raise ValidationError({"value": _("Feedback value must be either 1 or -1.")})
