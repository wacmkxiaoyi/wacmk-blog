export function classifyLink(href: string) {
  if (!href) {
    return "external";
  }
  if (href.startsWith("#")) {
    return "anchor";
  }
  if (/^(?:https?:)?\/\//i.test(href)) {
    return "external";
  }
  return "internal";
}
