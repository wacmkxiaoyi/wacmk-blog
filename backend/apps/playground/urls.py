from django.urls import path

from . import views


urlpatterns = [
    path("test/frontend/packages/modal", views.playground_page, name="playground-modal"),
    path(
        "test/frontend/packages/context-actions",
        views.playground_page,
        name="playground-context-actions",
    ),
    path(
        "test/frontend/packages/content-renderer",
        views.playground_page,
        name="playground-content-renderer",
    ),
    path("test/frontend/packages/table", views.playground_page, name="playground-table"),
    path("test/frontend/packages/editor", views.playground_page, name="playground-editor"),
    path(
        "test/frontend/packages/catalog-manager",
        views.playground_page,
        name="playground-catalog-manager",
    ),
    path("test/frontend/packages/card", views.playground_page, name="playground-card"),
    path("test/frontend/packages/tooltip", views.playground_page, name="playground-tooltip"),
]
