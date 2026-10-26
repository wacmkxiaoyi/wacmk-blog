export function externalLinkUrl(path, origin = globalThis.location?.origin) {
  return path ? new URL(path, origin).href : "";
}
