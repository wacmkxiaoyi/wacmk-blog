import { buildMenuTree } from "./buildMenuTree";
import { extractHeadingMenuItems } from "./extractHeadingMenuItems";
import { flattenMenuTree } from "./flattenMenuTree";

export function createContentNavigation(document, options = {}) {
  const sourceItems = extractHeadingMenuItems(document, options);
  const items =
    options.tree === false
      ? sourceItems.map((item) => ({ ...item, children: [] }))
      : buildMenuTree(sourceItems);
  const flatItems = options.tree === false ? items : flattenMenuTree(items);
  const itemMap = new Map(flatItems.map((item) => [item.id, item]));

  return {
    document: document || null,
    items,
    flatItems,
    getItemById(id) {
      return itemMap.get(id) || null;
    },
    hasItem(id) {
      return itemMap.has(id);
    },
  };
}
