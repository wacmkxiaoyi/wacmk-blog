from .common import CommonAccess


class VipAccessHandler(CommonAccess):

    @property
    def condition_rules(self):
        return self._get_rules_attr("vip_condition_rules", [])

    @property
    def effective_visibility(self):
        from apps.blog.models import Post as PostModel
        model_cls = PostModel if self._is_post else type(self.obj)
        return getattr(self.obj, "vip_access_permission", model_cls.VISIBILITY_PUBLIC)

    def evaluate(self, user):
        from .common import evaluate_condition_access
        return evaluate_condition_access(
            user,
            rules=self.condition_rules,
            has_purchase=False,
        )


__all__ = ["VipAccessHandler"]
