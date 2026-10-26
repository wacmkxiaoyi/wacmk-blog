class GroupService:
    @staticmethod
    def get_group_names(user):
        if not user or not getattr(user, "is_authenticated", False):
            return frozenset()
        return frozenset(str(name) for name in user.groups.values_list("name", flat=True) if str(name).strip())
