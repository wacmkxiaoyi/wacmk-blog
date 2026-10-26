import type {
  ContextActionGroup,
  ContextActionItem,
  NormalizedContextActionGroup,
} from "./types.ts";

export function normalizeContextActionGroups(
  groups: ContextActionGroup[] = [],
): NormalizedContextActionGroup[] {
  const grouped = new Map<number, ContextActionItem[]>();

  for (const group of groups) {
    if (!group || !Array.isArray(group.children) || !group.children.length) {
      continue;
    }

    const visibleChildren = group.children.filter(
      (child) => child && child.hidden !== true,
    );
    if (!visibleChildren.length) {
      continue;
    }

    const current = grouped.get(group.group) || [];
    grouped.set(group.group, current.concat(visibleChildren));
  }

  return Array.from(grouped.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([group, children]) => ({ group, children }));
}
