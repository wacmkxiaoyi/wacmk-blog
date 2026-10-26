from django.db.models import Count, Q
from .models import ResourceStar, ResourceVote


def attach_interactions(resources, user, resource_type):
    resources = list(resources)
    resource_ids = [resource.pk for resource in resources]
    if not resource_ids:
        return resources
    stars = ResourceStar.objects.filter(resource_type=resource_type, resource_id__in=resource_ids)
    votes = ResourceVote.objects.filter(resource_type=resource_type, resource_id__in=resource_ids)
    vote_counts = {
        item["resource_id"]: item
        for item in votes.values("resource_id").annotate(
            up_count=Count("id", filter=Q(vote=ResourceVote.VOTE_UP)),
            down_count=Count("id", filter=Q(vote=ResourceVote.VOTE_DOWN)),
        )
    }
    user_stars = {}
    user_votes = {}
    if getattr(user, "is_authenticated", False):
        user_stars = dict(stars.filter(user=user).values_list("resource_id", "created_at"))
        user_votes = dict(votes.filter(user=user).values_list("resource_id", "vote"))
    for resource in resources:
        counts = vote_counts.get(resource.pk, {})
        resource.interaction = {
            "isStarred": resource.pk in user_stars,
            "starredAt": user_stars.get(resource.pk),
            "currentVote": user_votes.get(resource.pk),
            "upCount": counts.get("up_count", 0),
            "downCount": counts.get("down_count", 0),
        }
    return resources


def interaction_payload(resource, user, resource_type):
    return attach_interactions([resource], user, resource_type)[0].interaction


def set_star(resource, user, resource_type, starred):
    if starred:
        ResourceStar.objects.get_or_create(resource_type=resource_type, resource_id=resource.pk, user=user)
    else:
        ResourceStar.objects.filter(resource_type=resource_type, resource_id=resource.pk, user=user).delete()
    return interaction_payload(resource, user, resource_type)


def set_vote(resource, user, resource_type, vote):
    if vote is None:
        ResourceVote.objects.filter(resource_type=resource_type, resource_id=resource.pk, user=user).delete()
    else:
        ResourceVote.objects.update_or_create(
            resource_type=resource_type,
            resource_id=resource.pk,
            user=user,
            defaults={"vote": vote},
        )
    return interaction_payload(resource, user, resource_type)
