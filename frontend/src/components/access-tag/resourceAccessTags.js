import { getValidConditions } from "./accessPresentation";

function getChannel(type, rules, isVIP = false) {
  const conditions = type === "conditional" ? getValidConditions(rules) : [];
  if (type === "conditional" && !conditions.length) return null;
  return {
    type: conditions.length ? "conditional" : type || "public",
    value: conditions.length ? rules : undefined,
    isVIP,
  };
}

export function getResourceAccessChannels(resource) {
  if (!resource) return [];

  const common = getChannel(resource.visibility, resource.condition_rules);
  if (resource.access_scope !== "standalone") return common ? [common] : [];

  return [
    common,
    getChannel(
      resource.vip_access_permission,
      resource.vip_condition_rules,
      true,
    ),
  ].filter(Boolean);
}
