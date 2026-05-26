from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
from django.utils.http import url_has_allowed_host_and_scheme


def get_client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def is_ajax_request(request):
    return request.headers.get("X-Requested-With") == "XMLHttpRequest"


def get_safe_next_url(request):
    next_url = (request.POST.get("next") or request.GET.get("next") or "").strip()
    if next_url and url_has_allowed_host_and_scheme(next_url, allowed_hosts={request.get_host()}, require_https=request.is_secure()):
        return next_url
    return ""


def with_fragment(url, fragment):
    base_url = (url or "").split("#", 1)[0]
    if not fragment:
        return base_url
    return f"{base_url}#{fragment}"


def ensure_session_key(request):
    if request.session.session_key:
        return request.session.session_key
    request.session.save()
    return request.session.session_key or ""


def get_feedback_value_from_request(request):
    raw_value = (request.POST.get("value") or "").strip()
    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        raise ValidationError({"value": _("Feedback value must be either 1 or -1.")})
    if value not in {-1, 1}:
        raise ValidationError({"value": _("Feedback value must be either 1 or -1.")})
    return value
