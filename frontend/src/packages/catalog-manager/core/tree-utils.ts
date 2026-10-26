import type { CatalogGroup, CatalogItem, Path } from "./types.ts";

export type MovePosition = "before" | "after" | "inside" | "append";

let keyCounter = 0;

export function generateKey(): string {
  keyCounter += 1;
  return `cg_${Date.now().toString(36)}_${keyCounter.toString(36)}`;
}

export function isCatalogGroup(item: CatalogItem): item is CatalogGroup {
  return Boolean(
    item &&
    typeof item === "object" &&
    "_kind" in item &&
    item._kind === "catalog-group",
  );
}

export function createGroup(title: string): CatalogGroup {
  return {
    _kind: "catalog-group",
    _key: generateKey(),
    title,
    children: [],
  };
}

export function getCatalogNodeKey(
  node: CatalogItem,
  fallbackPath?: Path,
): string {
  if (isCatalogGroup(node)) {
    return node._key;
  }

  if (node && typeof node === "object") {
    if (typeof node._key === "string" && node._key.trim()) {
      return node._key;
    }
    if (typeof node.id === "string" || typeof node.id === "number") {
      return `id:${String(node.id)}`;
    }
    if (typeof node.key === "string" || typeof node.key === "number") {
      return `key:${String(node.key)}`;
    }
  }

  return `path:${(fallbackPath || []).join("-")}`;
}

export function getNodeAtPath(
  items: CatalogItem[],
  path: Path,
): CatalogItem | null {
  if (!path.length) {
    return null;
  }

  let current: CatalogItem[] = items;

  for (let i = 0; i < path.length; i++) {
    const index = path[i];
    if (index < 0 || index >= current.length) {
      return null;
    }
    const node = current[index];

    if (i === path.length - 1) {
      return node;
    }

    if (!isCatalogGroup(node)) {
      return null;
    }

    current = node.children;
  }

  return null;
}

export function getParentArrayAtPath(
  items: CatalogItem[],
  path: Path,
): { parent: CatalogItem[]; index: number } | null {
  if (!path.length) {
    return { parent: items, index: -1 };
  }

  let current: CatalogItem[] = items;

  for (let i = 0; i < path.length - 1; i++) {
    const index = path[i];
    if (index < 0 || index >= current.length) {
      return null;
    }
    const node = current[index];
    if (!isCatalogGroup(node)) {
      return null;
    }
    current = node.children;
  }

  return { parent: current, index: path[path.length - 1] };
}

export function getArrayAtPath(
  items: CatalogItem[],
  path: Path,
): CatalogItem[] | null {
  if (!path.length) {
    return items;
  }

  let current: CatalogItem[] = items;

  for (let i = 0; i < path.length; i++) {
    const index = path[i];
    if (index < 0 || index >= current.length) {
      return null;
    }

    const node = current[index];
    if (!isCatalogGroup(node)) {
      return null;
    }

    current = node.children;
  }

  return current;
}

export function removeNodeAtPath(
  items: CatalogItem[],
  path: Path,
): CatalogItem | null {
  const info = getParentArrayAtPath(items, path);
  if (!info || info.index < 0) {
    return null;
  }

  const removed = info.parent[info.index];
  info.parent.splice(info.index, 1);
  return removed ?? null;
}

export function insertNodeAtPath(
  items: CatalogItem[],
  node: CatalogItem,
  path: Path,
  position: MovePosition,
  maxDepth?: number,
): boolean {
  if (position === "append") {
    const target = getArrayAtPath(items, path);
    if (!target) {
      return false;
    }

    if (typeof maxDepth === "number" && path.length >= maxDepth) {
      return false;
    }

    target.push(node);
    return true;
  }

  if (position === "inside") {
    const target = getNodeAtPath(items, path);
    if (!target || !isCatalogGroup(target)) {
      return false;
    }

    if (typeof maxDepth === "number") {
      const currentDepth = path.length;
      if (currentDepth >= maxDepth) {
        return false;
      }
    }

    target.children.push(node);
    return true;
  }

  const info = getParentArrayAtPath(items, path);
  if (!info) {
    return false;
  }

  const insertAt = position === "before" ? info.index : info.index + 1;
  info.parent.splice(insertAt, 0, node);
  return true;
}

export function moveNodeAtPath(
  items: CatalogItem[],
  fromPath: Path,
  toPath: Path,
  position: MovePosition,
  maxDepth?: number,
): CatalogItem[] {
  const copy = JSON.parse(JSON.stringify(items)) as CatalogItem[];

  if (
    pathsEqual(fromPath, toPath) &&
    (position === "before" || position === "after" || position === "inside")
  ) {
    return items;
  }

  const removed = removeNodeAtPath(copy, fromPath);
  if (!removed) {
    return items;
  }

  const adjustedPath = adjustTargetPathAfterRemoval(fromPath, toPath, position);
  insertNodeAtPath(copy, removed, adjustedPath, position, maxDepth);
  return copy;
}

export function canDropAsDescendant(dragPath: Path, targetPath: Path): boolean {
  if (dragPath.length >= targetPath.length) {
    return false;
  }

  for (let i = 0; i < dragPath.length; i++) {
    if (dragPath[i] !== targetPath[i]) {
      return false;
    }
  }

  return true;
}

function adjustTargetPathAfterRemoval(
  fromPath: Path,
  toPath: Path,
  position: MovePosition,
): Path {
  if (position === "inside" || position === "append") {
    if (startsWithPath(toPath, fromPath)) {
      return toPath;
    }
  }

  const adjusted = [...toPath];
  const parentLength = Math.min(fromPath.length, toPath.length) - 1;

  if (parentLength < 0) {
    return adjusted;
  }

  let sameParent = fromPath.length === toPath.length;
  for (let i = 0; i < parentLength; i++) {
    if (fromPath[i] !== toPath[i]) {
      sameParent = false;
      break;
    }
  }

  if (!sameParent) {
    return adjusted;
  }

  const fromIndex = fromPath[fromPath.length - 1];
  const toIndex = adjusted[adjusted.length - 1];
  if (fromIndex < toIndex) {
    adjusted[adjusted.length - 1] = toIndex - 1;
  }

  return adjusted;
}

function startsWithPath(path: Path, maybePrefix: Path): boolean {
  if (maybePrefix.length > path.length) {
    return false;
  }

  for (let i = 0; i < maybePrefix.length; i++) {
    if (path[i] !== maybePrefix[i]) {
      return false;
    }
  }

  return true;
}

function pathsEqual(left: Path, right: Path): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) {
      return false;
    }
  }

  return true;
}

export function canMoveUp(items: CatalogItem[], path: Path): boolean {
  const info = getParentArrayAtPath(items, path);
  return Boolean(info && info.index > 0);
}

export function canMoveDown(items: CatalogItem[], path: Path): boolean {
  const info = getParentArrayAtPath(items, path);
  return Boolean(
    info && info.index >= 0 && info.index < info.parent.length - 1,
  );
}

export function replaceNodeAtPath(
  items: CatalogItem[],
  path: Path,
  updater: (node: CatalogItem) => CatalogItem,
): CatalogItem[] {
  const copy = JSON.parse(JSON.stringify(items)) as CatalogItem[];
  const node = getNodeAtPath(copy, path);
  if (!node) {
    return items;
  }

  const info = getParentArrayAtPath(copy, path);
  if (!info || info.index < 0) {
    return items;
  }

  info.parent[info.index] = updater(
    JSON.parse(JSON.stringify(info.parent[info.index])),
  );
  return copy;
}
