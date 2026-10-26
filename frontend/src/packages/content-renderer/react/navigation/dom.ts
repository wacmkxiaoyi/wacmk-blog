function isDocumentLike(value) {
  return !!value && typeof value.getElementById === "function";
}

const HEADING_ID_ATTR = "data-content-heading-id";
const CONTENT_ANCHOR_ID_ATTR = "data-content-anchor-id";

function buildHeadingDataSelector(id) {
  return `[${HEADING_ID_ATTR}="${String(id).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
}

function buildContentAnchorSelector(id) {
  return `[${CONTENT_ANCHOR_ID_ATTR}="${String(id).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
}

export function buildScopedHeadingDomId(id, instanceId) {
  const safeInstanceId = String(instanceId || "default").trim() || "default";
  return `cr-${safeInstanceId}-${String(id || "")}`;
}

export function parseAnchorHref(value) {
  const href = String(value || "").trim();
  if (!href.startsWith("#")) {
    return "";
  }
  const fragment = href.slice(1);
  if (!fragment) {
    return "";
  }
  try {
    return decodeURIComponent(fragment);
  } catch (_error) {
    return fragment;
  }
}

function getDocumentFromRoot(root) {
  if (!root) {
    return typeof document === "undefined" ? null : document;
  }

  if (isDocumentLike(root)) {
    return root;
  }

  if (typeof Document !== "undefined" && root instanceof Document) {
    return root;
  }

  return (
    root.ownerDocument || (typeof document === "undefined" ? null : document)
  );
}

function escapeHeadingId(id) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(id);
  }

  return String(id).replace(/([#.;?+*~':"!^$\[\]()=>|/@])/g, "\\$1");
}

export function getHeadingElementById(id, root) {
  if (!id) {
    return null;
  }

  if (
    root &&
    !isDocumentLike(root) &&
    typeof root.querySelector === "function"
  ) {
    return (
      root.querySelector(buildHeadingDataSelector(id)) ||
      root.querySelector(buildContentAnchorSelector(id)) ||
      root.querySelector(`#${escapeHeadingId(id)}`)
    );
  }

  const doc = getDocumentFromRoot(root);
  if (!doc?.querySelector) {
    return null;
  }

  const scopedElement = doc.querySelector(buildHeadingDataSelector(id));
  if (scopedElement) {
    if (
      !root ||
      isDocumentLike(root) ||
      (typeof Document !== "undefined" && root instanceof Document)
    ) {
      return scopedElement;
    }
    if (typeof root.contains !== "function" || root.contains(scopedElement)) {
      return scopedElement;
    }
  }

  const contentAnchorElement = doc.querySelector(
    buildContentAnchorSelector(id),
  );
  if (contentAnchorElement) {
    if (
      !root ||
      isDocumentLike(root) ||
      (typeof Document !== "undefined" && root instanceof Document)
    ) {
      return contentAnchorElement;
    }
    if (
      typeof root.contains !== "function" ||
      root.contains(contentAnchorElement)
    ) {
      return contentAnchorElement;
    }
  }

  if (!doc?.getElementById) {
    return null;
  }

  const element = doc.getElementById(id);
  if (!element) {
    return null;
  }

  if (
    !root ||
    isDocumentLike(root) ||
    (typeof Document !== "undefined" && root instanceof Document)
  ) {
    return element;
  }

  if (typeof root.contains !== "function") {
    return element;
  }

  return root.contains(element) ? element : null;
}

export function scrollElementIntoViewWithOffset(element, options = {}) {
  if (!element) {
    return false;
  }

  const {
    root,
    behavior = "smooth",
    block = "start",
    inline = "nearest",
    offsetTop = 0,
  } = options;

  if (!offsetTop) {
    element.scrollIntoView({ behavior, block, inline });
    return true;
  }

  const doc = getDocumentFromRoot(root);
  const win =
    doc?.defaultView || (typeof window === "undefined" ? null : window);
  if (!win) {
    return false;
  }

  const rect = element.getBoundingClientRect();

  if (root && typeof Document !== "undefined" && !(root instanceof Document)) {
    const rootRect = root.getBoundingClientRect();
    const top = root.scrollTop + rect.top - rootRect.top - offsetTop;
    root.scrollTo({ top, behavior });
    return true;
  }

  const top = win.scrollY + rect.top - offsetTop;
  win.scrollTo({ top, behavior });
  return true;
}

export function setLocationHash(id, root) {
  const doc = getDocumentFromRoot(root);
  const win =
    doc?.defaultView || (typeof window === "undefined" ? null : window);
  if (!win?.history || !doc?.location) {
    return;
  }

  const hash = `#${id}`;
  const nextUrl = `${doc.location.pathname}${doc.location.search}${hash}`;
  win.history.replaceState(null, "", nextUrl);
}

export function getHeadingIdAttributeName() {
  return HEADING_ID_ATTR;
}

export function getContentAnchorIdAttributeName() {
  return CONTENT_ANCHOR_ID_ATTR;
}
