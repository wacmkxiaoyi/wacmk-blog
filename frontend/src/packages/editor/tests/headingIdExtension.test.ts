import { describe, expect, it } from "vitest";
import { normalizeEditorHeadingIds } from "../react/components/RichTextEditor/extensions/index.ts";

describe("editor heading id extension", () => {
  it("assigns ids for duplicate headings", () => {
    const editorDoc = normalizeEditorHeadingIds({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Alpha" }],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Alpha" }],
        },
      ],
    });

    expect(editorDoc.content[0].attrs.id).toBe("alpha");
    expect(editorDoc.content[1].attrs.id).toBe("alpha-2");
  });

  it("updates heading ids when heading text changes", () => {
    const editorDoc = normalizeEditorHeadingIds({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Beta Title" }],
        },
      ],
    });

    expect(editorDoc.content[0].attrs.id).toBe("beta-title");
  });
});
