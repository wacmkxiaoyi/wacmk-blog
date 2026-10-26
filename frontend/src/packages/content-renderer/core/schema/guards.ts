import type { BlockNode } from "./blocks";
import type { InlineNode } from "./inlines";

const BLOCK_NODE_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "list",
  "code-block",
  "table",
  "horizontal-rule",
  "callout",
  "admonition",
  "tabs",
  "math-block",
  "image",
  "video",
  "custom",
]);

const INLINE_NODE_TYPES = new Set([
  "text",
  "link",
  "inline-code",
  "inline-math",
  "emoji",
  "checkbox",
  "line-break",
]);

export function isBlockNode(value: unknown): value is BlockNode {
  return Boolean(
    value &&
    typeof value === "object" &&
    "type" in value &&
    BLOCK_NODE_TYPES.has(String(value.type)),
  );
}

export function isInlineNode(value: unknown): value is InlineNode {
  return Boolean(
    value &&
    typeof value === "object" &&
    "type" in value &&
    INLINE_NODE_TYPES.has(String(value.type)),
  );
}
