import {
  getHeadingElementById,
  scrollElementIntoViewWithOffset,
  setLocationHash,
} from "./dom";

function resolveTargetId(target) {
  if (!target) {
    return "";
  }

  return typeof target === "string" ? target : target.id || "";
}

export function navigateToContentHeading(target, options = {}) {
  const id = resolveTargetId(target);
  if (!id) {
    return false;
  }

  const element = getHeadingElementById(id, options.root);
  if (!element) {
    return false;
  }

  const didScroll = scrollElementIntoViewWithOffset(element, options);
  if (!didScroll) {
    return false;
  }

  if (options.updateHash) {
    setLocationHash(id, options.root);
  }

  if (options.focus && typeof element.focus === "function") {
    element.focus({ preventScroll: true });
  }

  return true;
}
