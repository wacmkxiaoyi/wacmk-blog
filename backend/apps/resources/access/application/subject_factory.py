from django.core.exceptions import ValidationError

from ..domain.constants import CONDITION_TYPE_ENCRYPTED, DEFAULT_ALLOWED_CONDITION_TYPES
from ..domain.rules import normalize_condition_rules
from ..domain.subject import ResourceSubject


class SubjectFactory:
    @staticmethod
    def build(resource, *, resource_type=None, allowed_condition_types=None):
        normalized_allowed_types = frozenset(allowed_condition_types or DEFAULT_ALLOWED_CONDITION_TYPES)
        condition_rules = normalize_condition_rules(getattr(resource, "condition_rules", []) or [], allowed_types=normalized_allowed_types)
        vip_condition_rules = normalize_condition_rules(getattr(resource, "vip_condition_rules", []) or [], allowed_types=normalized_allowed_types)
        password_hashes = {rule.type: str(rule.value or "") for rule in (*condition_rules, *vip_condition_rules) if rule.type == CONDITION_TYPE_ENCRYPTED}
        owner_user_id = None
        for field_name in ("author_id", "created_by_id", "uploaded_by_id", "owner_id", "owner"):
            if hasattr(resource, field_name):
                value = getattr(resource, field_name)
                owner_user_id = getattr(value, "pk", value)
                break
        if getattr(resource, "pk", None) is None:
            raise ValidationError("Resource must be saved before authorization can be evaluated.")
        return ResourceSubject(
            resource_type=str(resource_type or resource.__class__.__name__.lower()),
            resource_id=int(resource.pk),
            label=str(getattr(resource, "title", "") or getattr(resource, "name", "") or str(resource)),
            owner_user_id=owner_user_id,
            visibility=str(getattr(resource, "visibility", "public") or "public"),
            condition_rules=condition_rules,
            access_scope=str(getattr(resource, "access_scope", "unified") or "unified"),
            vip_access_permission=str(getattr(resource, "vip_access_permission", "public") or "public"),
            vip_condition_rules=vip_condition_rules,
            allowed_condition_types=normalized_allowed_types,
            password_hashes=password_hashes,
        )
