import { describe, expect, it, vi } from "vitest";
import React from "react";
import { createEditorTool } from "../core/index.ts";
import { buildDefaultEditorTools } from "../react/index.ts";
import { RichTextEditor } from "../react/index.ts";
import { getEditorModalSize } from "../react/components/RichTextEditor/helpers/richTextEditorRuntime.ts";

describe("editor builtin extension metadata", () => {
  it("supports executeVisual and context menu contributions on extension tools", () => {
    const tool = createEditorTool({
      key: "demo-tool",
      name: "Demo",
      icon: React.createElement("span", null, "D"),
      group: 1,
      executeVisual() {},
      contextNodeTypes: ["imageBlock"],
      getContextMenuGroups() {
        return [
          {
            group: 1,
            children: [{ key: "demo", label: "Demo", onClick() {} }],
          },
        ];
      },
    });

    expect(typeof tool.executeVisual).toBe("function");
    expect(tool.contextNodeTypes).toEqual(["imageBlock"]);
    expect(
      tool.getContextMenuGroups?.({
        toolContext: {
          mode: "visual",
          editor: null,
          markdownMode: false,
          navigationOpen: false,
          translate: (_key, fallback) => fallback,
          openModal() {},
          openInlinePanel() {},
          closeInlinePanel() {},
          runVisualCommand() {},
          runVisualInsertCommand() {},
          insertMarkdown() {},
          replaceMarkdownSelection() {},
          setMarkdownMode() {},
          setNavigationOpen() {},
          getDocument() {
            return {
              type: "document",
              version: 1,
              format: "rich-text",
              children: [],
            };
          },
        },
        target: null,
        event: {} as MouseEvent,
        contextNode: { pos: 1, node: { attrs: {} } },
        updateNodeAttrs() {},
        deleteNode() {},
      }),
    ).toHaveLength(1);
  });

  it("keeps RichTextEditor public export intact", () => {
    expect(typeof RichTextEditor).toBe("function");
  });

  it("places navigation next to markdown and keeps code tools under code group", () => {
    const tools = buildDefaultEditorTools((_key, fallback) => fallback);

    expect(tools.some((tool) => tool.key === "inline-code")).toBe(false);
    expect(tools.some((tool) => tool.key === "bold")).toBe(false);
    expect(tools.find((tool) => tool.key === "text-style")?.subTools).toEqual([
      "italic",
      "strike",
      "underline",
      "color",
    ]);
    expect(tools.find((tool) => tool.key === "code")?.subTools).toEqual([
      "code-block",
      "html",
    ]);
    expect(
      tools.find((tool) => tool.key === "horizontal-rule")?.subTools,
    ).toEqual(["anchor"]);
    expect(tools.find((tool) => tool.key === "link")?.subTools).toEqual([
      "link-current-article",
    ]);
    expect(tools.find((tool) => tool.key === "table")?.subTools).toEqual([
      "import-csv-tsv",
      "import-xlsx",
    ]);
    expect(tools.find((tool) => tool.key === "import-csv-tsv")?.name).toBe(
      "Import from CSV/TSV",
    );
    expect(tools.find((tool) => tool.key === "import-xlsx")?.name).toBe(
      "Import from XLS/XLSX",
    );
    expect(tools.find((tool) => tool.key === "html")?.group).toBe(2);
    expect(tools.find((tool) => tool.key === "html")?.order).toBe(3);
    expect(tools.find((tool) => tool.key === "navigation")?.order).toBe(2);
    expect(tools.find((tool) => tool.key === "markdown")?.order).toBe(1);
    expect(tools.find((tool) => tool.key === "fullscreen-editor")?.order).toBe(
      3,
    );
  });

  it("opens the html modal from the html tool and supports modify context action", () => {
    const tools = buildDefaultEditorTools((_key, fallback) => fallback);
    const htmlTool = tools.find((tool) => tool.key === "html");
    const openModal = vi.fn();

    htmlTool?.executeVisual?.({
      mode: "visual",
      editor: null,
      markdownMode: false,
      navigationOpen: false,
      translate: (_key, fallback) => fallback,
      openModal,
      openInlinePanel() {},
      closeInlinePanel() {},
      runVisualCommand() {},
      runVisualInsertCommand() {},
      insertMarkdown() {},
      replaceMarkdownSelection() {},
      setMarkdownMode() {},
      setNavigationOpen() {},
      getDocument() {
        return {
          type: "document",
          version: 1,
          format: "rich-text",
          children: [],
        };
      },
    });

    expect(openModal).toHaveBeenCalledWith("html");

    const groups = htmlTool?.customBlock?.getContextMenuGroups?.({
      kind: "html",
      data: { html: "<div>demo</div>" },
      pos: 7,
      editor: null,
      translate: (_key, fallback) => fallback,
      openModal,
      updateData() {},
      updateAttrs() {},
    });

    expect(groups?.[0]?.children?.[0]?.label).toBe("Modify");
    groups?.[0]?.children?.[0]?.onClick();
    expect(openModal).toHaveBeenLastCalledWith("html", {
      pos: 7,
      html: "<div>demo</div>",
    });
  });

  it("uses the wide modal size for HTML templates", () => {
    expect(getEditorModalSize("html")).toBe("wide");
  });

  it("opens the fullscreen modal from the fullscreen tool", () => {
    const tools = buildDefaultEditorTools((_key, fallback) => fallback);
    const fullscreenTool = tools.find(
      (tool) => tool.key === "fullscreen-editor",
    );
    const openModal = vi.fn();

    fullscreenTool?.executeVisual?.({
      mode: "visual",
      editor: null,
      markdownMode: false,
      navigationOpen: false,
      translate: (_key, fallback) => fallback,
      openModal,
      openInlinePanel() {},
      closeInlinePanel() {},
      runVisualCommand() {},
      runVisualInsertCommand() {},
      insertMarkdown() {},
      replaceMarkdownSelection() {},
      setMarkdownMode() {},
      setNavigationOpen() {},
      getDocument() {
        return {
          type: "document",
          version: 1,
          format: "rich-text",
          children: [],
        };
      },
    });

    expect(openModal).toHaveBeenCalledWith("fullscreen-editor");
  });

  it("opens the current article link modal with heading options", () => {
    const tools = buildDefaultEditorTools((_key, fallback) => fallback);
    const currentArticleLinkTool = tools.find(
      (tool) => tool.key === "link-current-article",
    );
    const openModal = vi.fn();

    currentArticleLinkTool?.executeVisual?.({
      mode: "visual",
      editor: {
        state: {
          selection: { empty: true },
        },
      },
      markdownMode: false,
      navigationOpen: false,
      translate: (_key, fallback) => fallback,
      openModal,
      openInlinePanel() {},
      closeInlinePanel() {},
      runVisualCommand() {},
      runVisualInsertCommand() {},
      insertMarkdown() {},
      replaceMarkdownSelection() {},
      setMarkdownMode() {},
      setNavigationOpen() {},
      getDocument() {
        return {
          type: "document",
          version: 1,
          format: "rich-text",
          children: [
            {
              type: "heading",
              id: "intro",
              level: 1,
              children: [{ type: "text", value: "Intro" }],
              meta: { tocIncluded: true },
            },
            {
              type: "heading",
              id: "details",
              level: 2,
              children: [{ type: "text", value: "Details" }],
              meta: { tocIncluded: true },
            },
            {
              type: "heading",
              id: "deep",
              level: 3,
              children: [{ type: "text", value: "Deep Dive" }],
              meta: { tocIncluded: true },
            },
            {
              type: "heading",
              id: "ignored",
              level: 4,
              children: [{ type: "text", value: "Ignored" }],
              meta: { tocIncluded: true },
            },
          ],
        };
      },
    });

    expect(openModal).toHaveBeenCalledWith("link-current-article", {
      label: "",
      linkType: "section",
      targetId: "intro",
      headingOptions: [
        { id: "intro", text: "Intro", level: 1 },
        { id: "details", text: "Details", level: 2 },
        { id: "deep", text: "Deep Dive", level: 3 },
      ],
      formulaOptions: [],
      anchorOptions: [],
    });
    expect(
      openModal.mock.calls[0][1].headingOptions.map((item) => item.text),
    ).toEqual(["Intro", "Details", "Deep Dive"]);
  });

  it("includes formula targets in current article link modal payload", () => {
    const tools = buildDefaultEditorTools((_key, fallback) => fallback);
    const currentArticleLinkTool = tools.find(
      (tool) => tool.key === "link-current-article",
    );
    const openModal = vi.fn();

    currentArticleLinkTool?.executeVisual?.({
      mode: "visual",
      editor: {
        state: {
          selection: { empty: true },
        },
      },
      markdownMode: false,
      navigationOpen: false,
      translate: (_key, fallback) => fallback,
      openModal,
      openInlinePanel() {},
      closeInlinePanel() {},
      runVisualCommand() {},
      runVisualInsertCommand() {},
      insertMarkdown() {},
      replaceMarkdownSelection() {},
      setMarkdownMode() {},
      setNavigationOpen() {},
      getDocument() {
        return {
          type: "document",
          version: 1,
          format: "rich-text",
          children: [
            {
              type: "heading",
              id: "intro",
              level: 1,
              children: [{ type: "text", value: "Intro" }],
              meta: { tocIncluded: true },
            },
            { type: "math-block", value: "E = mc^2" },
            { type: "math-block", value: "a^2 + b^2 = c^2" },
          ],
        };
      },
    });

    expect(openModal).toHaveBeenCalledWith("link-current-article", {
      label: "",
      linkType: "section",
      targetId: "intro",
      headingOptions: [{ id: "intro", text: "Intro", level: 1 }],
      formulaOptions: [
        { id: "equation-1", text: "Equation 1", number: 1 },
        { id: "equation-2", text: "Equation 2", number: 2 },
      ],
      anchorOptions: [],
    });
  });

  it("defaults to formula targets when the article has no headings", () => {
    const tools = buildDefaultEditorTools((_key, fallback) => fallback);
    const currentArticleLinkTool = tools.find(
      (tool) => tool.key === "link-current-article",
    );
    const openModal = vi.fn();

    currentArticleLinkTool?.executeVisual?.({
      mode: "visual",
      editor: {
        state: {
          selection: { empty: true },
        },
      },
      markdownMode: false,
      navigationOpen: false,
      translate: (_key, fallback) => fallback,
      openModal,
      openInlinePanel() {},
      closeInlinePanel() {},
      runVisualCommand() {},
      runVisualInsertCommand() {},
      insertMarkdown() {},
      replaceMarkdownSelection() {},
      setMarkdownMode() {},
      setNavigationOpen() {},
      getDocument() {
        return {
          type: "document",
          version: 1,
          format: "rich-text",
          children: [{ type: "math-block", value: "x+y" }],
        };
      },
    });

    expect(openModal).toHaveBeenCalledWith("link-current-article", {
      label: "",
      linkType: "formula",
      targetId: "equation-1",
      headingOptions: [],
      formulaOptions: [{ id: "equation-1", text: "Equation 1", number: 1 }],
      anchorOptions: [],
    });
  });

  it("includes anchor targets in current article link modal payload", () => {
    const tools = buildDefaultEditorTools((_key, fallback) => fallback);
    const currentArticleLinkTool = tools.find(
      (tool) => tool.key === "link-current-article",
    );
    const openModal = vi.fn();

    currentArticleLinkTool?.executeVisual?.({
      mode: "visual",
      editor: {
        state: {
          selection: { empty: true },
        },
      },
      markdownMode: false,
      navigationOpen: false,
      translate: (_key, fallback) => fallback,
      openModal,
      openInlinePanel() {},
      closeInlinePanel() {},
      runVisualCommand() {},
      runVisualInsertCommand() {},
      insertMarkdown() {},
      replaceMarkdownSelection() {},
      setMarkdownMode() {},
      setNavigationOpen() {},
      getDocument() {
        return {
          type: "document",
          version: 1,
          format: "rich-text",
          children: [{ type: "anchor", id: "foo-bar" }],
        };
      },
    });

    expect(openModal).toHaveBeenCalledWith("link-current-article", {
      label: "",
      linkType: "anchor",
      targetId: "foo-bar",
      headingOptions: [],
      formulaOptions: [],
      anchorOptions: [{ id: "foo-bar", text: "foo-bar" }],
    });
  });
});
