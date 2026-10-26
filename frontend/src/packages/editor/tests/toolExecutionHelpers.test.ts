import { describe, expect, it, vi } from "vitest";
import { executeEditorTool } from "../react/components/RichTextEditor/helpers/toolExecutionHelpers.ts";

function createContext() {
  return {
    mode: "visual" as const,
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
  };
}

describe("editor tool execution", () => {
  it("runs a markdown workflow instead of inserting its custom block", () => {
    const executeMarkdown = vi.fn();
    const insertMarkdown = vi.fn();

    executeEditorTool({
      tool: {
        key: "attachment",
        name: "Attachment",
        icon: null,
        group: 1,
        executeMarkdown,
        customBlock: { kind: "attachment", render: null },
      },
      editor: {},
      markdownMode: true,
      toolContext: { ...createContext(), mode: "markdown", markdownMode: true },
      insertMarkdown,
      toggleMarkdownMode: vi.fn(),
    });

    expect(executeMarkdown).toHaveBeenCalledOnce();
    expect(insertMarkdown).not.toHaveBeenCalled();
  });

  it("continues to serialize ordinary custom blocks in markdown mode", () => {
    const insertMarkdown = vi.fn();

    executeEditorTool({
      tool: {
        key: "custom",
        name: "Custom",
        icon: null,
        group: 1,
        customBlock: { kind: "notice", data: { title: "Note" }, render: null },
      },
      editor: {},
      markdownMode: true,
      toolContext: { ...createContext(), mode: "markdown", markdownMode: true },
      insertMarkdown,
      toggleMarkdownMode: vi.fn(),
    });

    expect(insertMarkdown).toHaveBeenCalledWith(
      '::custom{kind="notice" title="Note"}',
    );
  });
});
