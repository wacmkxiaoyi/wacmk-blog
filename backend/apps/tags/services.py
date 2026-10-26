from django.db.models import Count, Q

from .models import Tag


class TagDirectoryService:
    @staticmethod
    def list_tags(query=""):
        queryset = Tag.objects.filter(
            ~Q(articles__visibility="private")
        )
        if query:
            queryset = queryset.filter(name__icontains=query)
        return queryset.annotate(post_count=Count("articles", distinct=True)).distinct()
