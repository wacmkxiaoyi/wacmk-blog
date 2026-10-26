export function getContentQuota(user, settings) {
  if (user?.is_staff || user?.is_superuser) return Infinity;
  if (!settings?.allow_non_admin_create) return 0;
  const limit = Number(settings.non_admin_max_count);
  return Number.isFinite(limit) && limit > 0 ? limit : Infinity;
}

export function formatContentQuota(limit) {
  return limit === Infinity ? "∞" : String(limit);
}
