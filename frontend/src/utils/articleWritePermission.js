export function getArticleWritePermission(user, config) {
  if (user?.is_staff || user?.is_superuser)
    return { allowed: true, reason: null };
  const settings = config?.["content.article"];
  if (!settings?.allow_non_admin_create)
    return { allowed: false, reason: "disabled" };
  if (settings.vip_only && !(Number(user?.vip_level) > 0))
    return { allowed: false, reason: "vipOnly" };
  return { allowed: true, reason: null };
}
