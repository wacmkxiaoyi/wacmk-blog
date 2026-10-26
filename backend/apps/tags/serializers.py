from rest_framework import serializers

from .models import Tag


class TagDirectorySerializer(serializers.ModelSerializer):
    # This field becomes a visibility-aware annotation once posts are introduced.
    post_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Tag
        fields = ("id", "name", "post_count")
