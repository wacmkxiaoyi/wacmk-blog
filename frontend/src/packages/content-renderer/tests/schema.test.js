import { describe, expect, it } from "vitest";
import { isBlockNode, isInlineNode } from "../core/schema/index.ts";

describe("content-renderer schema", () => {
  it("recognizes block nodes", () => {
    expect(isBlockNode({ type: "paragraph", children: [] })).toBe(true);
    expect(isBlockNode({ type: "unknown" })).toBe(false);
  });

  it("recognizes inline nodes", () => {
    expect(isInlineNode({ type: "text", value: "hello" })).toBe(true);
    expect(isInlineNode({ type: "checkbox", checked: true })).toBe(true);
    expect(isInlineNode({ type: "unknown" })).toBe(false);
  });
});
