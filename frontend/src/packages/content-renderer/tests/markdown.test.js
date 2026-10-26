import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ContentRenderer } from "../react/components/ContentRenderer/ContentRenderer.tsx";
import { MarkdownAdapter } from "../presets/markdown/adapter/index.ts";
import { serializeDocumentToMarkdown } from "../presets/markdown/serialize/index.ts";

describe("content-renderer markdown preset", () => {
  it("parses base markdown and custom directives", () => {
    const document = MarkdownAdapter.parse(
      `# Title\n\n++underlined++\n\n::custom{kind="input" name="email"}`,
    );

    expect(document.type).toBe("document");
    expect(document.children[0].type).toBe("heading");
    expect(document.children[1].type).toBe("paragraph");
    expect(document.children[2].type).toBe("custom");
    expect(document.children[2].kind).toBe("input");

    const paragraph = document.children[1];
    expect(paragraph.children[0].type).toBe("text");
    expect(paragraph.children[0].marks?.[0]?.type).toBe("underline");
  });

  it("preserves fenced code block language metadata", () => {
    const document = MarkdownAdapter.parse("```js\nconsole.log('hello');\n```");

    expect(document.children[0].type).toBe("code-block");
    expect(document.children[0].language).toBe("js");
    expect(document.children[0].value).toBe("console.log('hello');");
  });

  it("parses markdown images", () => {
    const document = MarkdownAdapter.parse(
      '![diagram](https://example.com/diagram.png "Diagram")',
    );

    expect(document.children[0].type).toBe("image");
    expect(document.children[0].src).toBe("https://example.com/diagram.png");
    expect(document.children[0].alt).toBe("diagram");
    expect(document.children[0].title).toBe("Diagram");
  });

  it("parses github-style callout title separately from body", () => {
    const document = MarkdownAdapter.parse(
      [
        "> [!TIP] Renderer Playground",
        "> 这个 callout 用于展示 GitHub 风格提示块与标题行。",
      ].join("\n"),
    );

    expect(document.children[0].type).toBe("callout");
    expect(document.children[0].title).toBe("Renderer Playground");
    expect(document.children[0].children).toHaveLength(1);
    expect(document.children[0].children[0].type).toBe("paragraph");
    expect(document.children[0].children[0].children[0].value).toBe(
      "这个 callout 用于展示 GitHub 风格提示块与标题行。",
    );
  });

  it("parses and serializes extended markdown blocks", () => {
    const source = [
      '!!! error "Heads up"',
      "    Danger zone.",
      "",
      '::custom{kind="internal-post" slug="demo"}',
      "",
      "::html",
      ':: <div class="promo">',
      "::   <script>window.demo = 1</script>",
      ":: </div>",
      "",
      "| Name | Value |",
      "| --- | ---: |",
      "| A | 1 |",
    ].join("\n");

    const document = MarkdownAdapter.parse(source);
    expect(document.children[0].type).toBe("admonition");
    expect(document.children[0].variant).toBe("error");
    expect(document.children[0].collapsible).toBe(false);
    expect(document.children[1].type).toBe("custom");
    expect(document.children[2].type).toBe("custom");
    expect(document.children[2].kind).toBe("html");
    expect(document.children[2].data.html).toContain(
      "<script>window.demo = 1</script>",
    );
    expect(document.children[3].type).toBe("table");
    expect(document.children[3].align).toEqual([null, "right"]);

    const markdown = serializeDocumentToMarkdown(document);
    expect(markdown).toContain('!!! error "Heads up"');
    expect(markdown).toContain('::custom{kind="internal-post" slug="demo"}');
    expect(markdown).toContain("::html");
    expect(markdown).toContain(':: <div class="promo">');
    expect(markdown).toContain("| Name | Value |");
  });

  it("roundtrips structured blocks and directives", () => {
    const document = {
      type: "document",
      version: 1,
      format: "rich-text",
      children: [
        {
          type: "callout",
          variant: "tip",
          title: "Fast path",
          children: [
            {
              type: "paragraph",
              children: [{ type: "text", value: "Use hover tools." }],
            },
          ],
        },
        {
          type: "tabs",
          items: [
            {
              type: "tab-item",
              key: "a",
              label: "Alpha",
              children: [
                {
                  type: "paragraph",
                  children: [{ type: "text", value: "First tab" }],
                },
              ],
            },
            {
              type: "tab-item",
              key: "b",
              label: "Beta",
              children: [
                {
                  type: "paragraph",
                  children: [{ type: "text", value: "Second tab" }],
                },
              ],
            },
          ],
        },
        {
          type: "admonition",
          variant: "error",
          title: "Build failed",
          collapsible: false,
          defaultOpen: false,
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "text",
                  value: "Check parser output before publishing.",
                },
              ],
            },
          ],
        },
        {
          type: "video",
          src: "https://example.com/demo.mp4",
          title: "Demo",
          muted: true,
        },
        {
          type: "custom",
          kind: "internal-post",
          data: { slug: "abc" },
        },
        {
          type: "custom",
          kind: "html",
          data: {
            html: '<div class="demo"><script>window.rendered=true</script></div>',
          },
        },
      ],
    };

    const markdown = serializeDocumentToMarkdown(document);
    expect(markdown).toContain("> [!TIP] Fast path");
    expect(markdown).toContain('=== "Alpha"');
    expect(markdown).toContain(
      '::video{src="https://example.com/demo.mp4" title="Demo" muted="true"}',
    );
    expect(markdown).toContain('::custom{kind="internal-post" slug="abc"}');
    expect(markdown).toContain("::html");

    const reparsed = MarkdownAdapter.parse(markdown);
    expect(reparsed.children[0].type).toBe("callout");
    expect(reparsed.children[1].type).toBe("tabs");
    expect(reparsed.children[2].type).toBe("admonition");
    expect(reparsed.children[2].variant).toBe("error");
    expect(reparsed.children[3].type).toBe("video");
    expect(reparsed.children[4].type).toBe("custom");
    expect(reparsed.children[5].kind).toBe("html");
  });

  it("renders html blocks inside sandboxed iframes", () => {
    const html = renderToStaticMarkup(
      React.createElement(ContentRenderer, {
        format: "markdown",
        value: [
          "::html",
          ':: <div class="demo">Hello</div>',
          ":: <script>window.demo = 1</script>",
        ].join("\n"),
        adapter: MarkdownAdapter,
      }),
    );

    expect(html).toContain('class="cr-html-block-frame"');
    expect(html).toContain(
      'sandbox="allow-scripts allow-modals allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"',
    );
    expect(html).not.toContain("cr-html-block-header");
    expect(html).toContain(
      "&lt;div class=&quot;demo&quot;&gt;Hello&lt;/div&gt;",
    );
  });

  it("renders the first tab as active by default", () => {
    const value = ['=== "title"', "", "    这是第一个 tab 的正文。"].join("\n");

    const html = renderToStaticMarkup(
      React.createElement(ContentRenderer, {
        format: "markdown",
        value,
        adapter: MarkdownAdapter,
      }),
    );

    expect(html).toContain('class="cr-tab-button is-active"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('<section class="cr-tab-panel is-active">');
    expect(html).not.toContain('hidden="" class="cr-tab-panel is-active"');
  });

  it("parses blockquote and multiline math", () => {
    const source = [
      "> quote line",
      "> second line",
      "",
      "$$",
      "a^2 + b^2 = c^2",
      "$$",
      "",
      "Inline $x+y$ formula",
    ].join("\n");

    const document = MarkdownAdapter.parse(source);
    expect(document.children[0].type).toBe("blockquote");
    expect(document.children[1].type).toBe("math-block");
    expect(document.children[2].type).toBe("paragraph");
    expect(document.children[2].children[1].type).toBe("inline-math");
  });

  it("renders numbered block formulas with anchor ids", () => {
    const value = [
      "$$",
      "E = mc^2",
      "$$",
      "",
      "$$",
      "a^2 + b^2 = c^2",
      "$$",
    ].join("\n");

    const html = renderToStaticMarkup(
      React.createElement(ContentRenderer, {
        format: "markdown",
        value,
        adapter: MarkdownAdapter,
      }),
    );

    expect(html).toContain(
      'class="cr-math-block-shell" id="equation-1" data-content-anchor-id="equation-1"',
    );
    expect(html).toContain(
      'class="cr-math-block"><div class="cr-math-block-content"',
    );
    expect(html).toContain('class="cr-math-block-number">(1)</span>');
    expect(html).toContain('id="equation-2"');
    expect(html).toContain('class="cr-math-block-number">(2)</span>');
  });

  it("parses inline checkbox syntax inside paragraphs", () => {
    const document = MarkdownAdapter.parse("A[]B\n\n[] 待办\n\n[x]");

    expect(document.children[0].type).toBe("paragraph");
    expect(document.children[0].children.map((node) => node.type)).toEqual([
      "text",
      "checkbox",
      "text",
    ]);
    expect(document.children[0].children[0].value).toBe("A");
    expect(document.children[0].children[1].checked).toBe(false);
    expect(document.children[0].children[2].value).toBe("B");

    expect(document.children[1].type).toBe("paragraph");
    expect(document.children[1].children[0].type).toBe("checkbox");
    expect(document.children[1].children[0].checked).toBe(false);
    expect(document.children[1].children[1].type).toBe("text");
    expect(document.children[1].children[1].value).toBe(" 待办");

    expect(document.children[2].type).toBe("paragraph");
    expect(document.children[2].children).toHaveLength(1);
    expect(document.children[2].children[0].type).toBe("checkbox");
    expect(document.children[2].children[0].checked).toBe(true);
  });

  it("keeps inline checkbox syntax inside regular list items", () => {
    const document = MarkdownAdapter.parse("- A[]B");
    const list = document.children[0];

    expect(list.type).toBe("list");
    expect(list.items[0].checked).toBeUndefined();
    expect(list.items[0].children[0].children.map((node) => node.type)).toEqual(
      ["text", "checkbox", "text"],
    );
    expect(list.items[0].children[0].children[0].value).toBe("A");
    expect(list.items[0].children[0].children[1].checked).toBe(false);
    expect(list.items[0].children[0].children[2].value).toBe("B");
  });

  it("parses task lists, nested lists, and list continuations", () => {
    const source = [
      "- [ ] 发布前检查",
      "  需要在发布窗口前确认下列事项。",
      "",
      "  - [x] 内容渲染器支持普通列表",
      "  - [ ] 验证嵌套列表在移动端的换行与缩进",
      "    这里是一段续行文本，用于检查 checkbox 后的多行内容是否正确对齐。",
      "",
      "1. [x] 合并功能分支",
      "2. [ ] 跑完整测试",
    ].join("\n");

    const document = MarkdownAdapter.parse(source);
    const unorderedList = document.children[0];
    const orderedList = document.children[1];

    expect(unorderedList.type).toBe("list");
    expect(unorderedList.items[0].checked).toBe(false);
    expect(unorderedList.items[0].children[0].type).toBe("paragraph");
    expect(unorderedList.items[0].children[0].children[0].value).toBe(
      "发布前检查\n需要在发布窗口前确认下列事项。",
    );
    expect(unorderedList.items[0].children[1].type).toBe("list");
    expect(unorderedList.items[0].children[1].items[0].checked).toBe(true);
    expect(unorderedList.items[0].children[1].items[1].checked).toBe(false);
    expect(
      unorderedList.items[0].children[1].items[1].children[0].children[0].value,
    ).toBe(
      "验证嵌套列表在移动端的换行与缩进\n这里是一段续行文本，用于检查 checkbox 后的多行内容是否正确对齐。",
    );

    expect(orderedList.type).toBe("list");
    expect(orderedList.ordered).toBe(true);
    expect(orderedList.start).toBe(1);
    expect(orderedList.items[0].checked).toBe(true);
    expect(orderedList.items[1].checked).toBe(false);
  });

  it("serializes task lists and preserves nested list structure on roundtrip", () => {
    const document = {
      type: "document",
      version: 1,
      format: "rich-text",
      children: [
        {
          type: "list",
          ordered: false,
          items: [
            {
              type: "list-item",
              checked: false,
              children: [
                {
                  type: "paragraph",
                  children: [
                    {
                      type: "text",
                      value: "发布前检查\n需要在发布窗口前确认下列事项。",
                    },
                  ],
                },
                {
                  type: "list",
                  ordered: false,
                  items: [
                    {
                      type: "list-item",
                      checked: true,
                      children: [
                        {
                          type: "paragraph",
                          children: [
                            { type: "text", value: "内容渲染器支持普通列表" },
                          ],
                        },
                      ],
                    },
                    {
                      type: "list-item",
                      checked: false,
                      children: [
                        {
                          type: "paragraph",
                          children: [
                            {
                              type: "text",
                              value:
                                "验证嵌套列表在移动端的换行与缩进\n这里是一段续行文本，用于检查 checkbox 后的多行内容是否正确对齐。",
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const markdown = serializeDocumentToMarkdown(document);
    expect(markdown).toContain("- [ ] 发布前检查");
    expect(markdown).toContain("  需要在发布窗口前确认下列事项。");
    expect(markdown).toContain("  - [x] 内容渲染器支持普通列表");
    expect(markdown).toContain("  - [ ] 验证嵌套列表在移动端的换行与缩进");

    const reparsed = MarkdownAdapter.parse(markdown);
    const list = reparsed.children[0];
    expect(list.type).toBe("list");
    expect(list.items[0].checked).toBe(false);
    expect(list.items[0].children[0].children[0].value).toBe(
      "发布前检查\n需要在发布窗口前确认下列事项。",
    );
    expect(list.items[0].children[1].type).toBe("list");
    expect(list.items[0].children[1].items[0].checked).toBe(true);
    expect(list.items[0].children[1].items[1].checked).toBe(false);
  });

  it("serializes inline checkboxes back to markdown syntax", () => {
    const document = {
      type: "document",
      version: 1,
      format: "rich-text",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "text", value: "A" },
            { type: "checkbox", checked: false },
            { type: "text", value: "B" },
          ],
        },
        {
          type: "paragraph",
          children: [
            { type: "checkbox", checked: true },
            { type: "text", value: " done" },
          ],
        },
      ],
    };

    const markdown = serializeDocumentToMarkdown(document);
    expect(markdown).toContain("A[]B");
    expect(markdown).toContain("[x] done");

    const reparsed = MarkdownAdapter.parse(markdown);
    expect(reparsed.children[0].children.map((node) => node.type)).toEqual([
      "text",
      "checkbox",
      "text",
    ]);
    expect(reparsed.children[0].children[0].value).toBe("A");
    expect(reparsed.children[0].children[1].checked).toBe(false);
    expect(reparsed.children[0].children[2].value).toBe("B");
    expect(reparsed.children[1].children[0].type).toBe("checkbox");
    expect(reparsed.children[1].children[0].checked).toBe(true);
    expect(reparsed.children[1].children[1].value).toBe(" done");
  });

  it("preserves multiple paragraphs inside a list item on roundtrip", () => {
    const source = ["- 第一段说明", "", "  第二段说明"].join("\n");

    const document = MarkdownAdapter.parse(source);
    expect(document.children[0].items[0].children).toHaveLength(2);

    const markdown = serializeDocumentToMarkdown(document);
    const reparsed = MarkdownAdapter.parse(markdown);
    expect(reparsed.children[0].items[0].children).toHaveLength(2);
    expect(reparsed.children[0].items[0].children[0].type).toBe("paragraph");
    expect(reparsed.children[0].items[0].children[1].type).toBe("paragraph");
  });

  it("allows serializer registry overrides by node type", () => {
    const document = {
      type: "document",
      version: 1,
      format: "rich-text",
      children: [
        {
          type: "callout",
          variant: "tip",
          title: "Fast path",
          children: [
            {
              type: "paragraph",
              children: [{ type: "text", value: "Use hover tools." }],
            },
          ],
        },
      ],
    };

    const markdown = serializeDocumentToMarkdown(document, {
      callout: {
        serialize(node) {
          return `::callout{variant="${node.variant}" title="${node.title}"}`;
        },
      },
    });

    expect(markdown).toBe('::callout{variant="tip" title="Fast path"}');
  });
});
