from .common import CommonAccess
from .vip import VipAccessHandler
from .vip_check import check_is_vip_user


STANDALONE_SCOPE = "standalone"


def get_access_handler(obj, user=None):
    scope = getattr(obj, "access_scope", "unified")
    if scope == STANDALONE_SCOPE and user and check_is_vip_user(user):
        return VipAccessHandler(obj)
    return CommonAccess(obj)


def object_has_vip_standalone(obj):
    return bool(
        getattr(obj, "access_scope", "unified") == STANDALONE_SCOPE
        and getattr(obj, "vip_access_permission", "")
    )


__all__ = ["get_access_handler", "object_has_vip_standalone", "STANDALONE_SCOPE"]
