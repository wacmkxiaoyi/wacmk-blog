export const DEFAULT_RESOURCE_ACCESS_ACTIONS = {
  password: "password",
  purchase: "purchase",
};

export function isAccessDecision(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof value.allGranted === "boolean" &&
    Array.isArray(value.conditions),
  );
}

export function getConditionKey(condition, index) {
  return String(condition?.id || `${condition?.type || "condition"}-${index}`);
}

export function getConditionAction(condition) {
  return typeof condition?.action === "string" ? condition.action : "none";
}

export function getConditionTone(condition) {
  if (condition?.status === "granted") return "granted";
  if (
    Object.values(DEFAULT_RESOURCE_ACCESS_ACTIONS).includes(
      getConditionAction(condition),
    )
  )
    return "actionable";
  return "blocked";
}

export function normalizeAccessDecision(decision) {
  if (!isAccessDecision(decision)) return null;
  return {
    ...decision,
    conditions: decision.conditions.map((condition, index) => ({
      ...condition,
      id: getConditionKey(condition, index),
      action: getConditionAction(condition),
    })),
  };
}
