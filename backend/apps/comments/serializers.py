from rest_framework import serializers

from .models import ArticleComment
from apps.resources.media_urls import avatar_url


class CommentParticipantSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    displayName = serializers.SerializerMethodField()
    isStaff = serializers.BooleanField(source="is_staff", read_only=True)
    isSuperuser = serializers.BooleanField(source="is_superuser", read_only=True)
    avatarUrl = serializers.SerializerMethodField()
    vipLevel = serializers.SerializerMethodField()
    vipName = serializers.SerializerMethodField()

    def get_displayName(self, user):
        return user.get_full_name() or user.username

    def get_avatarUrl(self, user):
        if not user.avatar:
            return ""
        return avatar_url(user)

    def get_vipLevel(self, user):
        return self.context["identities"][user.pk].vip_level

    def get_vipName(self, user):
        level = self.get_vipLevel(user)
        return self.context["vip_names"].get(level, f"VIP {level}") if level else ""


class ArticleCommentSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    articleId = serializers.IntegerField(source="article_id", read_only=True)
    parentId = serializers.SerializerMethodField()
    replyTo = serializers.SerializerMethodField()
    authorId = serializers.IntegerField(source="author_id", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    upvoteCount = serializers.IntegerField(read_only=True)
    downvoteCount = serializers.IntegerField(read_only=True)
    viewerVote = serializers.CharField(read_only=True, allow_null=True)
    replies = serializers.SerializerMethodField()
    canEdit = serializers.SerializerMethodField()
    canDelete = serializers.SerializerMethodField()

    class Meta:
        model = ArticleComment
        fields = ("id", "articleId", "parentId", "replyTo", "authorId", "content", "is_deleted", "createdAt", "updatedAt", "upvoteCount", "downvoteCount", "viewerVote", "replies", "canEdit", "canDelete")
        read_only_fields = fields

    def get_parentId(self, obj):
        return str(obj.parent_id) if obj.parent_id else None

    def get_replyTo(self, obj):
        if not obj.reply_to_id:
            return None
        return {"commentId": str(obj.reply_to_id), "authorId": obj.reply_to.author_id}

    def get_replies(self, obj):
        if obj.parent_id is not None:
            return []
        return ArticleCommentSerializer(getattr(obj, "thread_replies", []), many=True, context=self.context).data

    def get_canEdit(self, obj):
        user = self.context["request"].user
        return bool(user.is_authenticated and not obj.is_deleted and (user.pk == obj.author_id or user.is_staff or user.is_superuser))

    def get_canDelete(self, obj):
        user = self.context["request"].user
        return bool(user.is_authenticated and not obj.is_deleted and (user.pk == obj.author_id or user.is_staff or user.is_superuser))


class CreateCommentSerializer(serializers.Serializer):
    content = serializers.CharField(max_length=10000, trim_whitespace=True)
    parentId = serializers.IntegerField(required=False)
    replyToId = serializers.IntegerField(required=False)

    def validate_content(self, value):
        if not value.strip():
            raise serializers.ValidationError("Comment content cannot be empty.")
        return value


class UpdateCommentSerializer(serializers.Serializer):
    content = serializers.CharField(max_length=10000, trim_whitespace=True)

    def validate_content(self, value):
        if not value.strip():
            raise serializers.ValidationError("Comment content cannot be empty.")
        return value


class ReactionSerializer(serializers.Serializer):
    vote = serializers.ChoiceField(choices=("up", "down"), allow_null=True)
