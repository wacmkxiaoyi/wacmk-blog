from django.contrib.auth.views import LogoutView
from django.urls import path

from .views import CuteLoginView, ForgotPasswordView, RegisterView, SendEmailChangeCodeView, SendRegisterCodeView


urlpatterns = [
    path("login/", CuteLoginView.as_view(), name="login"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot-password"),
    path("register/", RegisterView.as_view(), name="register"),
    path("register/send-code/", SendRegisterCodeView.as_view(), name="register-send-code"),
    path("profile/email/send-code/", SendEmailChangeCodeView.as_view(), name="profile-email-send-code"),
    path("logout/", LogoutView.as_view(), name="logout"),
]
