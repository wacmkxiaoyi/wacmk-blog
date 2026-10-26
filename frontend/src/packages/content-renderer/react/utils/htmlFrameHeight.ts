type HtmlFrameDocument = {
  body?: {
    children?: ArrayLike<unknown>;
    textContent?: string | null;
    scrollHeight?: number;
    getBoundingClientRect?: () => DOMRect;
  };
  documentElement?: { scrollHeight?: number };
};

const NON_RENDERED_TAGS = new Set(["SCRIPT", "STYLE", "TEMPLATE"]);

function isRenderedElement(element: unknown): element is {
  tagName?: string;
  getBoundingClientRect: () => DOMRect;
} {
  return Boolean(
    element &&
    typeof (element as { getBoundingClientRect?: unknown })
      .getBoundingClientRect === "function" &&
    !NON_RENDERED_TAGS.has(
      String((element as { tagName?: unknown }).tagName || "").toUpperCase(),
    ),
  );
}

export function getHtmlFrameContentHeight(doc: HtmlFrameDocument | null) {
  const body = doc?.body;
  if (!body) {
    return 0;
  }

  const bodyTop = body.getBoundingClientRect?.().top || 0;
  let contentBottom = 0;

  Array.from(body.children || []).forEach((element) => {
    if (!isRenderedElement(element)) {
      return;
    }
    const rect = element.getBoundingClientRect();
    contentBottom = Math.max(contentBottom, rect.bottom - bodyTop);
  });

  if (contentBottom > 0) {
    return Math.ceil(contentBottom);
  }

  if (body.textContent?.trim()) {
    return Math.ceil(
      body.scrollHeight || doc?.documentElement?.scrollHeight || 0,
    );
  }

  return 0;
}
