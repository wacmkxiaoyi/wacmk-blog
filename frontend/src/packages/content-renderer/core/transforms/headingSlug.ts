const NON_WORD_RE = /[^\w\-\u4e00-\u9fff]+/g;

export function buildHeadingSlug(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[\s\u3000]+/g, "-")
    .replace(NON_WORD_RE, "")
    .replace(/\-+/g, "-")
    .replace(/^\-+|\-+$/g, "");
}
