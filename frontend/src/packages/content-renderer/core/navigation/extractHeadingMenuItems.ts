import { plainTextFromInlines } from "../utils/text";
import {
  DEFAULT_MAX_HEADING_LEVEL,
  DEFAULT_MIN_HEADING_LEVEL,
} from "./constants";

export function extractHeadingMenuItems(document, options = {}) {
  const {
    minLevel = DEFAULT_MIN_HEADING_LEVEL,
    maxLevel = DEFAULT_MAX_HEADING_LEVEL,
    includeUntitled = false,
    filter,
  } = options;

  if (!document?.children?.length) {
    return [];
  }

  return document.children.reduce((items, node) => {
    if (
      node?.type !== "heading" ||
      node.meta?.tocIncluded === false ||
      !node.id
    ) {
      return items;
    }

    const text = plainTextFromInlines(node.children).trim();
    if (!includeUntitled && !text) {
      return items;
    }

    if (node.level < minLevel || node.level > maxLevel) {
      return items;
    }

    const item = {
      id: node.id,
      level: node.level,
      text,
      children: [],
    };

    if (typeof filter === "function" && !filter(item)) {
      return items;
    }

    items.push(item);
    return items;
  }, []);
}
