from django.urls import path

from . import views

urlpatterns = [
    path("auth/login/", views.LoginView.as_view(), name="api-login"),
    path("auth/register/", views.RegisterView.as_view(), name="api-register"),
    path("auth/register/send-code/", views.SendRegisterCodeView.as_view(), name="api-register-send-code"),
    path("auth/forgot-password/", views.ForgotPasswordView.as_view(), name="api-forgot-password"),
    path("auth/reset-password/", views.ResetPasswordView.as_view(), name="api-reset-password"),
    path("auth/refresh/", views.TokenRefreshView.as_view(), name="api-token-refresh"),
    path("auth/me/", views.MeView.as_view(), name="api-me"),
    path("profile/", views.ProfileView.as_view(), name="api-profile"),
    path("profile/money-history/", views.ProfileMoneyHistoryView.as_view(), name="api-profile-money-history"),
    path("profile/points-history/", views.ProfilePointsHistoryView.as_view(), name="api-profile-points-history"),
    path("profile/email/send-code/", views.SendEmailChangeCodeView.as_view(), name="api-profile-email-send-code"),
    path("profile/email/", views.ChangeEmailView.as_view(), name="api-profile-email"),
    path("profile/password/", views.ChangePasswordView.as_view(), name="api-profile-password"),
    path("site/config/", views.SiteConfigView.as_view(), name="api-site-config"),
    path("manage/users/", views.ManagedUserListView.as_view(), name="manage-user-list"),
    path("manage/users/<int:pk>/", views.ManagedUserDetailView.as_view(), name="manage-user-detail"),
    path("manage/users/<int:pk>/role/", views.ManagedUserRoleView.as_view(), name="manage-user-role"),
    path("manage/users/<int:pk>/balances/", views.ManagedUserBalancesView.as_view(), name="manage-user-balances"),
    path("manage/users/<int:pk>/password/", views.ManagedUserPasswordView.as_view(), name="manage-user-password"),
    path("users/<int:pk>/namecard/", views.UserNamecardView.as_view(), name="user-namecard"),
]
