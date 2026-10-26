from django.core import signing


def delivery_url(payload):
    token = signing.dumps(payload, salt="resources.media-delivery")
    return f"/api/resources/media-delivery/{token}/"


def avatar_url(user):
    return f"/api/resources/public-media/avatars/{user.pk}/" if user.avatar else ""


def site_asset_url(field):
    return f"/api/resources/public-media/site-assets/{field}/"


def cover_url(resource, resource_type, user):
    if not resource.cover_image:
        return ""
    if resource_type == "draft":
        allowed = bool(user.is_authenticated and (user.is_staff or user.is_superuser or resource.author_id == user.id))
    elif resource_type == "book":
        # A discoverable book needs a visual preview in list cards. The book and
        # its chapters remain protected by their normal access checks on entry.
        allowed = resource.visibility != "private" or bool(
            user.is_authenticated
            and (user.is_staff or user.is_superuser or resource.created_by_id == user.id)
        )
    else:
        from .access.application.resource_check_service import ResourceCheckService

        allowed = ResourceCheckService.build_access_check(resource, user, resource_type="article").all_granted
    if not allowed:
        return ""
    if resource_type != "draft" and resource.visibility == "public":
        return f"/api/resources/public-media/{resource_type}s/{resource.pk}/cover/"
    return delivery_url({
        "cover_type": resource_type,
        "cover_id": resource.pk,
        "cover_name": resource.cover_image.name,
        "cover_updated_at": resource.updated_at.isoformat(),
    })
