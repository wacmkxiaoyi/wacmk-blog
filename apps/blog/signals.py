from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.dispatch import receiver
from django.utils.translation import gettext_lazy as _

from .models import AuditLog
from .utils.audit import write_audit_log


@receiver(user_logged_in)
def audit_user_logged_in(sender, request, user, **kwargs):
    write_audit_log(request, AuditLog.ACTION_LOGIN, str(_("User signed in: %(username)s")) % {"username": user.username}, user=user)


@receiver(user_logged_out)
def audit_user_logged_out(sender, request, user, **kwargs):
    username = getattr(user, "username", str(_("anonymous user")))
    write_audit_log(request, AuditLog.ACTION_LOGOUT, str(_("User signed out: %(username)s")) % {"username": username}, user=user)
