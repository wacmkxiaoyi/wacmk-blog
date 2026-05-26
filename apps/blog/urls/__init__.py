from .book import urlpatterns as book_urlpatterns
from .comment import urlpatterns as comment_urlpatterns
from .manage import urlpatterns as manage_urlpatterns
from .post import urlpatterns as post_urlpatterns
from .profile import urlpatterns as profile_urlpatterns
from .tag import urlpatterns as tag_urlpatterns

urlpatterns = [
    *post_urlpatterns,
    *book_urlpatterns,
    *comment_urlpatterns,
    *tag_urlpatterns,
    *profile_urlpatterns,
    *manage_urlpatterns,
]
