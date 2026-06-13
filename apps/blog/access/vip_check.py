def check_is_vip_user(user):
    if not user or not getattr(user, "is_authenticated", False):
        return False
    from apps.blog.utils.site import build_user_business_identity_summary
    identity = build_user_business_identity_summary(user)
    return bool(identity.get("is_vip", False))
