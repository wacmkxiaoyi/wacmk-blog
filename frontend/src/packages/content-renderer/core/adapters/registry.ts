import type { ContentFormat } from "../schema";
import type { ContentAdapter } from "./types";

export type AdapterRegistry = Partial<Record<ContentFormat, ContentAdapter>>;

export function getAdapterForFormat(
  registry: AdapterRegistry,
  format: ContentFormat,
  overrideAdapter,
) {
  return overrideAdapter || registry[format] || null;
}
