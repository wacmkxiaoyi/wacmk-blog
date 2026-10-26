from apps.authorization_core.application.user_identity_service import UserIdentityService

from ..domain import ConditionDecision, ResourceAccessContext, ResourceAccessDecision
from ..domain.constants import ACTION_NONE, CONDITION_LABELS, CONDITION_TYPE_MONEY, STATUS_GRANTED, STATUS_INVALID_CONDITION, STATUS_PURCHASE_REQUIRED, VISIBILITY_PRIVATE, VISIBILITY_PUBLIC
from ..domain.registry import get as get_evaluator
from .handler_resolver import HandlerResolver
from .subject_factory import SubjectFactory
from .unlock_service import UnlockService


class ResourceCheckService:
    @classmethod
    def build_access_check(cls, resource, user, *, book_context=False, context=None, resource_type=None, allowed_condition_types=None):
        resolved_context = context or ResourceAccessContext(book_context=book_context)
        identity = UserIdentityService.resolve(user)
        subject = SubjectFactory.build(resource, resource_type=resource_type, allowed_condition_types=allowed_condition_types)
        return cls.build_access_check_for_subject(resource, subject, identity, resolved_context)

    @classmethod
    def build_access_check_for_subject(cls, resource, subject, identity, context):
        handler = HandlerResolver.resolve(subject, identity)
        unlock_state = UnlockService.get_unlock_state(resource, identity, resource_type=subject.resource_type)

        if handler.has_bypass_access(identity):
            return ResourceAccessDecision(resource_type=subject.resource_type, resource_id=subject.resource_id, label=subject.label, access_scope=subject.access_scope, effective_channel=handler.channel, is_vip=identity.is_vip, all_granted=True, conditions=tuple())

        if handler.visibility == VISIBILITY_PRIVATE:
            return ResourceAccessDecision(resource_type=subject.resource_type, resource_id=subject.resource_id, label=subject.label, access_scope=subject.access_scope, effective_channel=handler.channel, is_vip=identity.is_vip, all_granted=False, conditions=tuple())

        if handler.visibility == VISIBILITY_PUBLIC and not handler.condition_rules:
            return ResourceAccessDecision(resource_type=subject.resource_type, resource_id=subject.resource_id, label=subject.label, access_scope=subject.access_scope, effective_channel=handler.channel, is_vip=identity.is_vip, all_granted=True, conditions=tuple())

        all_granted = True
        conditions = []
        for rule in handler.condition_rules:
            evaluator = get_evaluator(rule.type)
            if evaluator is None:
                all_granted = False
                conditions.append(ConditionDecision(type=rule.type, label=CONDITION_LABELS.get(rule.type, rule.type), icon="circle-question", tone=rule.type, requirement="-", status=STATUS_INVALID_CONDITION, action=ACTION_NONE))
                continue
            result = evaluator.evaluate(rule=rule, subject=subject, identity=identity, context=context, unlock_state=unlock_state)
            status = result["status"]
            if status != STATUS_GRANTED:
                all_granted = False
            conditions.append(ConditionDecision(type=rule.type, label=evaluator.label, icon=evaluator.icon, tone=evaluator.tone, requirement=str(result.get("requirement") or "-"), status=status, action=result.get("action", ACTION_NONE), original_requirement=result.get("original_requirement"), discounted_requirement=result.get("discounted_requirement"), discount_rate=result.get("discount_rate", ""), discount_applied=bool(result.get("discount_applied", False))))

        settlement_required = any(condition.type == CONDITION_TYPE_MONEY and condition.status == STATUS_PURCHASE_REQUIRED for condition in conditions)
        can_finalize = bool(conditions) and all(condition.status == STATUS_GRANTED or (condition.type == CONDITION_TYPE_MONEY and condition.status == STATUS_PURCHASE_REQUIRED) for condition in conditions)
        return ResourceAccessDecision(resource_type=subject.resource_type, resource_id=subject.resource_id, label=subject.label, access_scope=subject.access_scope, effective_channel=handler.channel, is_vip=identity.is_vip, all_granted=all_granted, can_finalize=can_finalize, settlement_required=settlement_required, conditions=tuple(conditions))
