from rest_framework import serializers


class ResourceAccessQuerySerializer(serializers.Serializer):
    book_context = serializers.BooleanField(required=False, default=False)
    bookId = serializers.IntegerField(required=False, min_value=1)


class ResourcePasswordSerializer(serializers.Serializer):
    password = serializers.CharField(trim_whitespace=False)
    book_context = serializers.BooleanField(required=False, default=False)
    bookId = serializers.IntegerField(required=False, min_value=1)


class ResourcePurchaseSerializer(serializers.Serializer):
    book_context = serializers.BooleanField(required=False, default=False)
    bookId = serializers.IntegerField(required=False, min_value=1)
