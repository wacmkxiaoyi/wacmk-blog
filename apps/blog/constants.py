from django.conf import settings


LEGACY_VIP_GROUP_NAME = "vip"
VIP_GROUP_PREFIX = "vip_"


def get_default_business_group_name():
    return settings.REGISTER_DEFAULT_GROUP_NAME


def get_vip_group_name(level):
    return f"{VIP_GROUP_PREFIX}{int(level)}"


def is_business_group_name(group_name):
    if not group_name:
        return False
    if group_name == get_default_business_group_name():
        return True
    if group_name == LEGACY_VIP_GROUP_NAME:
        return True
    return group_name.startswith(VIP_GROUP_PREFIX)


def get_business_group_names(max_level=0):
    names = [get_default_business_group_name()]
    for level in range(1, max(int(max_level or 0), 0) + 1):
        names.append(get_vip_group_name(level))
    return names
