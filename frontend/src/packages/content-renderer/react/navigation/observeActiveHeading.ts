import { getHeadingElementById } from "./dom";

function getScrollTarget(root) {
  if (root && typeof root.addEventListener === "function") {
    return root;
  }

  if (typeof window !== "undefined") {
    return window;
  }

  return null;
}

function getScrollPosition(root) {
  if (root && typeof root.scrollTop === "number") {
    return root.scrollTop;
  }

  if (typeof window !== "undefined") {
    return window.scrollY || window.pageYOffset || 0;
  }

  return 0;
}

function resolveHeadingTop(element, root) {
  const rect = element.getBoundingClientRect();
  if (root && typeof root.getBoundingClientRect === "function") {
    return root.scrollTop + rect.top - root.getBoundingClientRect().top;
  }

  if (typeof window !== "undefined") {
    return (window.scrollY || window.pageYOffset || 0) + rect.top;
  }

  return rect.top;
}

function selectActiveHeading(elements, root, offsetTop = 0) {
  if (!elements.length) {
    return null;
  }

  const currentLine = getScrollPosition(root) + offsetTop;
  let activeElement = elements[0];

  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    const elementTop = resolveHeadingTop(element, root);
    if (elementTop > currentLine) {
      break;
    }
    activeElement = element;
  }

  return activeElement;
}

export function observeActiveHeading(items, onChange, options = {}) {
  const elements = items
    .map((item) => getHeadingElementById(item.id, options.root || document))
    .filter(Boolean);

  if (!elements.length) {
    return () => {};
  }

  let activeId = null;
  const scrollTarget = getScrollTarget(options.root || null);

  function syncActiveHeading() {
    const activeElement = selectActiveHeading(
      elements,
      options.root || null,
      options.offsetTop || 0,
    );
    const nextId =
      activeElement?.getAttribute?.("data-content-heading-id") ||
      activeElement?.id ||
      null;
    if (nextId === activeId) {
      return;
    }

    activeId = nextId;
    onChange(activeId);
  }

  syncActiveHeading();

  if (!scrollTarget?.addEventListener) {
    return () => {};
  }

  scrollTarget.addEventListener("scroll", syncActiveHeading, { passive: true });
  if (typeof window !== "undefined" && scrollTarget !== window) {
    window.addEventListener("resize", syncActiveHeading);
  }

  return () => {
    scrollTarget.removeEventListener("scroll", syncActiveHeading);
    if (typeof window !== "undefined" && scrollTarget !== window) {
      window.removeEventListener("resize", syncActiveHeading);
    }
  };
}
