import { describe, expect, it } from "vitest";
import {
  markdownToEditorDoc,
  editorDocToContentDocument,
} from "../core/index.ts";

describe("editor anchor bridge", () => {
  it("roundtrips native anchor directives through editor bridges", () => {
    const editorDoc = markdownToEditorDoc('::anchor{id="Foo Bar"}');
    const document = editorDocToContentDocument(editorDoc);

    expect(editorDoc.content[0]).toMatchObject({
      type: "anchorBlock",
      attrs: { id: "foo-bar" },
    });
    expect(document.children[0]).toMatchObject({
      type: "anchor",
      id: "foo-bar",
    });
  });
});
