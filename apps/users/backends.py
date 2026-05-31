from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend


UserModel = get_user_model()


class UsernameOrEmailBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        login_identifier = (username or kwargs.get(UserModel.USERNAME_FIELD) or "").strip()
        if not login_identifier or password is None:
            return None

        if "@" in login_identifier:
            matches = list(UserModel._default_manager.filter(email__iexact=login_identifier)[:2])
            if len(matches) != 1:
                return None
            user = matches[0]
        else:
            try:
                user = UserModel._default_manager.get_by_natural_key(login_identifier)
            except UserModel.DoesNotExist:
                return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
