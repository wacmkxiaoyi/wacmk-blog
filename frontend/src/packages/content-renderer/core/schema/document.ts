import type { BlockNode } from "./blocks";
import type { ContentFormat, DocumentMeta } from "./meta";

export type ContentDocument = {
  type: "document";
  version: 1;
  format: ContentFormat;
  children: BlockNode[];
  meta?: DocumentMeta;
};
