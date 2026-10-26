from django.core.management.base import BaseCommand, CommandError

from apps.resources.models import Article, Book
from apps.resources.zinc_search_apis import ZincSearchError, ensure_indexes, get_article_document, get_book_document, index_article, index_book


class Command(BaseCommand):
    help = "Re-index existing keyword documents after an index mapping change."

    def handle(self, *args, **options):
        try:
            ensure_indexes()
            for article in Article.objects.select_related("author").prefetch_related("tags"):
                document = get_article_document(article.pk)
                index_article(article, document.get("abstract", ""), document.get("content", ""))
            for book in Book.objects.select_related("created_by"):
                document = get_book_document(book.pk)
                index_book(book, document.get("abstract", ""))
        except ZincSearchError as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(self.style.SUCCESS("ZincSearch keyword indexes rebuilt."))
