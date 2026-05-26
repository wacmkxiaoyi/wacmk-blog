from django.contrib import admin

from .models import AuditLog, Book, Comment, Post, PostDraft, Tag


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "created_at")
    search_fields = ("name", "slug")


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("title", "status", "visibility", "author", "published_at", "updated_at")
    list_filter = ("status", "visibility", "tags", "books")
    search_fields = ("title", "summary", "content")
    prepopulated_fields = {"slug": ("title",)}
    filter_horizontal = ("tags", "books")


@admin.register(PostDraft)
class PostDraftAdmin(admin.ModelAdmin):
    list_display = ("title", "source_post", "visibility", "author", "updated_at")
    list_filter = ("visibility", "tags", "books")
    search_fields = ("title", "summary", "content")
    prepopulated_fields = {"slug": ("title",)}
    filter_horizontal = ("tags", "books")


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "created_at")
    search_fields = ("name", "slug")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "user", "message", "ip_address", "created_at")
    list_filter = ("action",)
    search_fields = ("message", "user__username", "user__email")


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("id", "post", "author", "parent", "created_at")
    list_filter = ("post",)
    search_fields = ("content", "author__username", "author__email", "post__title")
