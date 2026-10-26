export function getBookWritePermission(user, config, ownedCount) {
  if (user?.is_staff || user?.is_superuser)
    return { allowed: true, reason: null };
  const settings = config?.["content.book"];
  if (!settings?.allow_non_admin_create)
    return { allowed: false, reason: "disabled" };
  if (settings.vip_only && !(Number(user?.vip_level) > 0))
    return { allowed: false, reason: "vipOnly" };
  if (
    Number(settings.non_admin_max_count) > 0 &&
    Number(ownedCount) >= Number(settings.non_admin_max_count)
  )
    return { allowed: false, reason: "limitReached" };
  return { allowed: true, reason: null };
}
