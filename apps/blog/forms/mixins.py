import json

from django import forms
from django.utils.translation import gettext_lazy as _

from apps.blog.permissions import (
    CONDITION_TYPE_ENCRYPTED,
    get_password_condition_rule,
    hash_condition_password,
    normalize_condition_rules,
)


class AccessScopeFormMixin:

    def _init_condition_rules_fields(self):
        self.existing_password_rule_types = self._get_existing_password_rule_types("condition_rules")
        self.initial["condition_rules"] = json.dumps(self._get_editor_condition_rules("condition_rules"), ensure_ascii=True)
        if getattr(self.instance, "condition_rules", None):
            self.initial["visibility"] = getattr(self.Meta.model, "VISIBILITY_CONDITIONAL", "conditional")
        self.existing_vip_password_rule_types = self._get_existing_password_rule_types("vip_condition_rules")
        self.initial["vip_condition_rules"] = json.dumps(self._get_editor_condition_rules("vip_condition_rules"), ensure_ascii=True)
        if getattr(self.instance, "vip_condition_rules", None):
            self.initial["vip_access_permission"] = getattr(self.Meta.model, "VISIBILITY_CONDITIONAL", "conditional")

    def _get_existing_password_rule_types(self, field_name):
        existing_types = []
        for rule in getattr(self.instance, field_name, []) or []:
            if not isinstance(rule, dict):
                continue
            if str(rule.get("type") or "").strip().lower() != CONDITION_TYPE_ENCRYPTED:
                continue
            if str(rule.get("value") or "").strip():
                existing_types.append(CONDITION_TYPE_ENCRYPTED)
        return existing_types

    def _get_editor_condition_rules(self, field_name):
        rules = []
        for rule in getattr(self.instance, field_name, []) or []:
            if not isinstance(rule, dict):
                continue
            condition_type = str(rule.get("type") or "").strip().lower()
            if not condition_type:
                continue
            if condition_type == CONDITION_TYPE_ENCRYPTED:
                rules.append({"type": condition_type})
                continue
            if "value" in rule:
                rules.append({"type": condition_type, "value": rule.get("value")})
                continue
            rules.append({"type": condition_type})
        return rules

    def _clean_condition_rules_field(self, field_name, error_label=None):
        raw_value = (self.cleaned_data.get(field_name) or "").strip()
        if not raw_value:
            return []
        try:
            payload = json.loads(raw_value)
        except (TypeError, ValueError) as exc:
            raise forms.ValidationError(_("Invalid condition data.")) from exc
        if payload == []:
            return []
        try:
            return normalize_condition_rules(payload, allowed_types=self.CONDITIONAL_ALLOWED_TYPES)
        except Exception as exc:
            raise forms.ValidationError(exc.messages[0] if hasattr(exc, "messages") else str(exc)) from exc

    def _get_existing_encrypted_password(self, field_name):
        existing_rule = get_password_condition_rule(
            getattr(self.instance, field_name, []) or [], allowed_types=self.CONDITIONAL_ALLOWED_TYPES
        )
        return "" if existing_rule is None else str(existing_rule.get("value") or "")

    def _get_mutable_encrypted_rule(self, condition_rules):
        for rule in condition_rules:
            if str(rule.get("type") or "").strip().lower() == CONDITION_TYPE_ENCRYPTED:
                return rule
        return None

    def _apply_access_scope_clean(self, cleaned_data):
        visibility = cleaned_data.get("visibility")
        condition_rules = list(cleaned_data.get("condition_rules") or [])

        if visibility == getattr(self.Meta.model, "VISIBILITY_PUBLIC", "public"):
            cleaned_data["access_scope"] = getattr(self.Meta.model, "ACCESS_SCOPE_UNIFIED", "unified")

        access_scope = cleaned_data.get("access_scope") or getattr(self.Meta.model, "ACCESS_SCOPE_UNIFIED", "unified")
        vip_access_permission = cleaned_data.get("vip_access_permission") or getattr(self.Meta.model, "VISIBILITY_PUBLIC", "public")
        vip_condition_rules = list(cleaned_data.get("vip_condition_rules") or [])

        if visibility == getattr(self.Meta.model, "VISIBILITY_CONDITIONAL", "conditional"):
            if not condition_rules:
                self.add_error("visibility", _("At least one complete condition is required."))
        else:
            condition_rules = []

        if vip_access_permission == getattr(self.Meta.model, "VISIBILITY_CONDITIONAL", "conditional"):
            if access_scope != getattr(self.Meta.model, "ACCESS_SCOPE_STANDALONE", "standalone"):
                self.add_error("vip_access_permission", _("VIP conditions require Standalone access scope."))
            elif not vip_condition_rules:
                self.add_error("vip_access_permission", _("At least one complete VIP condition is required."))
        else:
            vip_condition_rules = []

        return condition_rules, vip_condition_rules

    def _hash_encrypted_passwords(self, cleaned_data, condition_rules, vip_condition_rules):
        vip_encrypted_rule = self._get_mutable_encrypted_rule(vip_condition_rules)
        vip_encrypted_password = str((vip_encrypted_rule or {}).get("value") or "").strip()

        if vip_encrypted_rule and not vip_encrypted_password and CONDITION_TYPE_ENCRYPTED not in self.existing_vip_password_rule_types:
            self.add_error("vip_condition_rules", _("Password cannot be empty for VIP-encrypted content."))
        if vip_encrypted_rule and not vip_encrypted_password and CONDITION_TYPE_ENCRYPTED in self.existing_vip_password_rule_types:
            vip_encrypted_rule["value"] = self._get_existing_encrypted_password("vip_condition_rules")
        elif vip_encrypted_rule:
            vip_encrypted_rule["value"] = hash_condition_password(vip_encrypted_password)

        encrypted_rule = self._get_mutable_encrypted_rule(condition_rules)
        encrypted_password = str((encrypted_rule or {}).get("value") or "").strip()

        if encrypted_rule and not encrypted_password and CONDITION_TYPE_ENCRYPTED not in self.existing_password_rule_types:
            self.add_error("condition_rules", _("Password cannot be empty for encrypted content."))
        if encrypted_rule and not encrypted_password and CONDITION_TYPE_ENCRYPTED in self.existing_password_rule_types:
            encrypted_rule["value"] = self._get_existing_encrypted_password("condition_rules")
        elif encrypted_rule:
            encrypted_rule["value"] = hash_condition_password(encrypted_password)

        cleaned_data["condition_rules"] = condition_rules
        cleaned_data["vip_condition_rules"] = vip_condition_rules
        return cleaned_data


__all__ = ["AccessScopeFormMixin"]
