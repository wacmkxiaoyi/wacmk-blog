from django.urls import path

from apps.blog.views.book import BookDetailView, BookListView, BookShareDetailView, BookShareLinkCreateView

urlpatterns = [
    path("books/", BookListView.as_view(), name="book-list"),
    path("book/<slug:slug>/", BookDetailView.as_view(), name="book-detail"),
    path("book/<slug:slug>/share-links/", BookShareLinkCreateView.as_view(), name="book-share-create"),
    path("book-share/<str:token>/", BookShareDetailView.as_view(), name="book-share-detail"),
]
