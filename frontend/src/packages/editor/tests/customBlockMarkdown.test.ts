import { describe, expect, it, vi } from "vitest";
import {
  customBlockToMarkdown,
  markdownToEditorDoc,
  editorDocToContentDocument,
} from "../core/index.ts";

describe("editor custom block bridge", () => {
  it("serializes custom blocks to markdown directives", () => {
    const markdown = customBlockToMarkdown("email-form", {
      title: "Newsletter signup",
      label: "Email",
      placeholder: "name@example.com",
    });

    expect(markdown).toContain('::custom{kind="email-form"');
    expect(markdown).toContain('title="Newsletter signup"');
    expect(markdown).toContain('label="Email"');
  });

  it("roundtrips custom markdown directives through editor bridges", () => {
    const editorDoc = markdownToEditorDoc(
      '::custom{kind="email-form" title="Newsletter signup" buttonText="Submit"}',
    );
    const document = editorDocToContentDocument(editorDoc);

    expect(editorDoc.content[0].type).toBe("customBlock");
    expect(editorDoc.content[0].attrs.kind).toBe("email-form");
    expect(document.children[0].type).toBe("custom");
    expect(document.children[0].kind).toBe("email-form");
    expect(document.children[0].data.buttonText).toBe("Submit");
  });

  it("roundtrips html blocks through editor bridges", () => {
    const editorDoc = markdownToEditorDoc(
      ["::html", ":: <section>", "::   <h1>Hello</h1>", ":: </section>"].join(
        "\n",
      ),
    );
    const document = editorDocToContentDocument(editorDoc);

    expect(editorDoc.content[0].type).toBe("customBlock");
    expect(editorDoc.content[0].attrs.kind).toBe("html");
    expect(editorDoc.content[0].attrs.data.html).toBe(
      "<section>\n  <h1>Hello</h1>\n</section>",
    );
    expect(document.children[0].type).toBe("custom");
    expect(document.children[0].kind).toBe("html");
    expect(document.children[0].data.html).toBe(
      "<section>\n  <h1>Hello</h1>\n</section>",
    );
  });

  it("converts external workflow markdown into visual editor nodes", () => {
    expect(
      markdownToEditorDoc("![Cover](/media/cover.png)").content[0],
    ).toMatchObject({
      type: "imageBlock",
      attrs: { src: "/media/cover.png", alt: "Cover" },
    });
    expect(
      markdownToEditorDoc('::video{src="/media/demo.mp4" title="Demo"}')
        .content[0],
    ).toMatchObject({
      type: "videoBlock",
      attrs: { src: "/media/demo.mp4", title: "Demo" },
    });
    expect(
      markdownToEditorDoc("[Article](/articles/example/)").content[0],
    ).toMatchObject({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Article",
          marks: [{ type: "link", attrs: { href: "/articles/example/" } }],
        },
      ],
    });
    expect(
      markdownToEditorDoc(
        '::custom{kind="attachment" id="7" title="Archive" filename="archive.zip"}',
      ).content[0],
    ).toMatchObject({
      type: "customBlock",
      attrs: {
        kind: "attachment",
        data: { id: "7", title: "Archive", filename: "archive.zip" },
      },
    });
  });

  it("assigns stable heading ids and toc metadata for editor documents", () => {
    const editorDoc = markdownToEditorDoc(
      ["# Alpha", "", "## Alpha", "", "### Beta"].join("\n"),
    );
    const document = editorDocToContentDocument(editorDoc);

    expect(document.children[0]).toMatchObject({
      type: "heading",
      id: "alpha",
      meta: { anchorable: true, tocIncluded: true },
    });
    expect(document.children[1]).toMatchObject({
      type: "heading",
      id: "alpha-2",
      meta: { anchorable: true, tocIncluded: true },
    });
    expect(document.children[2]).toMatchObject({
      type: "heading",
      id: "beta",
      meta: { anchorable: true, tocIncluded: true },
    });
  });

  it("preserves explicit heading ids through content round-trip", () => {
    const editorDoc = markdownToEditorDoc("# Placeholder");
    editorDoc.content[0].attrs.id = "custom-heading";
    const document = editorDocToContentDocument(editorDoc);

    expect(document.children[0]).toMatchObject({
      type: "heading",
      id: "custom-heading",
      meta: { anchorable: true, tocIncluded: true },
    });
  });
});
