import type { BlockNode, ContentDocument, InlineNode } from "../schema";

export type ContentNode = BlockNode | InlineNode;

export type ContentPlugin = {
  name: string;
  transformDocument?: (document: ContentDocument) => ContentDocument;
  transformNode?: (node: ContentNode) => ContentNode;
};
