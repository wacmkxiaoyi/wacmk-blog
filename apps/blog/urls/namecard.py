from django.urls import path

from apps.blog.views.namecard import UserNamecardView

urlpatterns = [
    path("user/<int:user_id>/namecard/", UserNamecardView.as_view(), name="user-namecard"),
]
