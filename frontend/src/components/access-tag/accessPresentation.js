export const ACCESS_TYPES = Object.freeze({
  PUBLIC: "public",
  PRIVATE: "private",
  CONDITIONAL: "conditional",
});

const CONDITION_TYPES = Object.freeze({
  money: { icon: "coins", tone: "money", labelKey: "access.conditions.money" },
  points: { icon: "gem", tone: "points", labelKey: "access.conditions.points" },
  encrypted: {
    icon: "lock",
    tone: "encrypted",
    labelKey: "access.conditions.encrypted",
  },
  book_only: {
    icon: "book",
    tone: "book-only",
    labelKey: "access.conditions.bookOnly",
  },
});

const VISIBILITY_TYPES = Object.freeze({
  public: {
    icon: "users",
    tone: "public",
    labelKey: "access.visibility.public",
  },
  private: {
    icon: "user",
    tone: "private",
    labelKey: "access.visibility.private",
  },
});

export function normalizeAccessType(type) {
  return String(type || "")
    .trim()
    .toLowerCase();
}

export function getVisibilityPresentation(type) {
  return VISIBILITY_TYPES[normalizeAccessType(type)] || null;
}

export function getConditionPresentation(condition) {
  if (!condition || typeof condition !== "object") return null;
  const type = normalizeAccessType(condition.type);
  const presentation = CONDITION_TYPES[type];
  if (!presentation) return null;

  if (
    (type === "money" || type === "points") &&
    (!Number.isFinite(Number(condition.value)) || Number(condition.value) < 1)
  ) {
    return null;
  }

  return {
    ...presentation,
    type,
    value:
      type === "money" || type === "points"
        ? Number(condition.value)
        : undefined,
  };
}

export function getValidConditions(value) {
  if (!Array.isArray(value)) return [];
  const seenTypes = new Set();
  return value.reduce((conditions, item) => {
    const presentation = getConditionPresentation(item);
    if (!presentation || seenTypes.has(presentation.type)) return conditions;
    seenTypes.add(presentation.type);
    conditions.push(presentation);
    return conditions;
  }, []);
}

export function getAccessPresentation(type, value) {
  const normalizedType = normalizeAccessType(type);
  if (normalizedType === ACCESS_TYPES.CONDITIONAL) {
    const conditions = getValidConditions(value);
    return conditions.length === 1
      ? { kind: "condition", ...conditions[0] }
      : null;
  }
  const visibility = getVisibilityPresentation(normalizedType);
  return visibility
    ? { kind: "visibility", type: normalizedType, ...visibility }
    : null;
}
