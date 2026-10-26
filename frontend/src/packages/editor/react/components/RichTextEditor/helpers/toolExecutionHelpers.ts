import { customBlockToMarkdown } from "../../../../core/bridges.ts";
import { canExecuteToolInMarkdown } from "../../../../core/toolRegistry.ts";
import type {
  EditorToolContext,
  EditorToolDefinition,
} from "../../../../core/types.ts";

export type InlinePanelType = "color" | "table";

export type LegacyToolHelpers = {
  openInlinePanel?: (type: InlinePanelType) => void;
};

export function buildLegacyToolMap(helpers: LegacyToolHelpers = {}) {
  return {
    paragraph: {
      isActive: (context) => context.editor?.isActive?.("paragraph") || false,
      executeVisual: (context) =>
        context.editor.chain().focus().setParagraph().run(),
    },
    "text-style": {
      isActive: (context) => context.editor?.isActive?.("bold") || false,
      executeVisual: (context) =>
        context.editor.chain().focus().toggleBold().run(),
      markdownInsert: "**text**",
    },
    lists: {
      isActive: (context) => context.editor?.isActive?.("bulletList") || false,
      executeVisual: (context) =>
        context.editor.chain().focus().toggleBulletList().run(),
      markdownInsert: "- item",
    },
    code: {
      isActive: (context) => context.editor?.isActive?.("code") || false,
      executeVisual: (context) =>
        context.editor.chain().focus().toggleCode().run(),
      markdownInsert: "`code`",
    },
    math: {
      executeVisual: (context) => context.openModal("inline-math"),
      markdownInsert: "\\(x+y\\)",
    },
    blocks: {
      isActive: (context) => context.editor?.isActive?.("blockquote") || false,
      executeVisual: (context) =>
        context.editor.chain().focus().toggleBlockquote().run(),
      markdownInsert: "> quote",
    },
    color: {
      executeVisual: (context) => context.openInlinePanel("color"),
      markdownInsert: "[Text]{.md-color-blue}",
    },
    "inline-math": {
      executeVisual: (context) => context.openModal("inline-math"),
      markdownInsert: "\\(x+y\\)",
    },
    "math-block": {
      isActive: (context) => context.editor?.isActive?.("mathBlock") || false,
      executeVisual: (context) => context.openModal("math-block"),
      markdownInsert: "$$\nformula\n$$",
    },
  };
}

export function isToolbarToolDisabled(
  tool: EditorToolDefinition,
  markdownMode: boolean,
  toolContext: EditorToolContext,
) {
  if (markdownMode && !canExecuteToolInMarkdown(tool)) {
    return true;
  }
  return Boolean(tool.isDisabled?.(toolContext));
}

export function isToolActive(editor, markdownMode: boolean, toolKey: string) {
  if (!editor || markdownMode) {
    return toolKey === "markdown" && markdownMode;
  }

  const activeLookup = {
    paragraph: () => editor.isActive("paragraph"),
    bold: () => editor.isActive("bold"),
    italic: () => editor.isActive("italic"),
    strike: () => editor.isActive("strike"),
    underline: () => editor.isActive("underline"),
    "inline-code": () => editor.isActive("code"),
    code: () => editor.isActive("code"),
    "bullet-list": () => editor.isActive("bulletList"),
    "ordered-list": () => editor.isActive("orderedList"),
    "task-list": () => editor.isActive("taskList"),
    "code-block": () => editor.isActive("codeBlock"),
    math: () => editor.isActive("inlineMath"),
    "math-block": () => editor.isActive("mathBlock"),
    blocks: () => editor.isActive("blockquote"),
    h1: () => editor.isActive("heading", { level: 1 }),
    h2: () => editor.isActive("heading", { level: 2 }),
    h3: () => editor.isActive("heading", { level: 3 }),
    h4: () => editor.isActive("heading", { level: 4 }),
    h5: () => editor.isActive("heading", { level: 5 }),
    markdown: () => markdownMode,
  };

  if (typeof activeLookup[toolKey] === "function") {
    return activeLookup[toolKey]();
  }

  return false;
}

export function executeCustomBlockTool(
  tool: EditorToolDefinition,
  toolContext: EditorToolContext,
) {
  if (!toolContext.editor || !tool.customBlock?.kind) {
    return false;
  }
  const customData =
    tool.customBlock.createData?.(toolContext) || tool.customBlock.data || {};
  toolContext.runVisualInsertCommand(() =>
    toolContext.editor
      .chain()
      .focus()
      .insertContent({
        type: "customBlock",
        attrs: {
          kind: tool.customBlock.kind,
          data: customData,
          indent: 0,
        },
      })
      .run(),
  );
  return true;
}

export function executeFallbackTool(
  tool: EditorToolDefinition,
  toolContext: EditorToolContext,
  event?: unknown,
  helpers: LegacyToolHelpers = {},
) {
  const legacyToolMap = buildLegacyToolMap(helpers);
  const config = legacyToolMap[tool.key];
  if (!config?.executeVisual) {
    return false;
  }
  config.executeVisual(toolContext, event);
  return true;
}

export function executeEditorTool({
  tool,
  editor,
  markdownMode,
  toolContext,
  event,
  insertMarkdown,
  toggleMarkdownMode,
  helpers = {},
}: {
  tool: EditorToolDefinition;
  editor: unknown;
  markdownMode: boolean;
  toolContext: EditorToolContext;
  event?: unknown;
  insertMarkdown: (value: string) => void;
  toggleMarkdownMode: () => void;
  helpers?: LegacyToolHelpers;
}) {
  if (!editor && !markdownMode) {
    return;
  }

  if (tool.key === "markdown") {
    toggleMarkdownMode();
    return;
  }

  if (tool.key === "navigation") {
    toolContext.setNavigationOpen(!toolContext.navigationOpen);
    return;
  }

  if (isToolbarToolDisabled(tool, markdownMode, toolContext)) {
    return;
  }

  if (markdownMode) {
    if (tool.key === "html") {
      tool.onClick?.(toolContext);
      return;
    }
    if (typeof tool.markdownInsert === "function") {
      insertMarkdown(tool.markdownInsert(toolContext));
      return;
    }
    if (typeof tool.markdownInsert === "string") {
      insertMarkdown(tool.markdownInsert);
      return;
    }
    if (typeof tool.executeMarkdown === "function") {
      tool.executeMarkdown(toolContext, event);
      return;
    }
    if (tool.customBlock?.kind) {
      const customData =
        tool.customBlock.createData?.(toolContext) ||
        tool.customBlock.data ||
        {};
      insertMarkdown(customBlockToMarkdown(tool.customBlock.kind, customData));
      return;
    }
    tool.onClick?.(toolContext);
    return;
  }

  if (typeof tool.executeVisual === "function") {
    tool.executeVisual(toolContext, event);
    return;
  }

  if (tool.customBlock?.kind && executeCustomBlockTool(tool, toolContext)) {
    return;
  }

  if (executeFallbackTool(tool, toolContext, event, helpers)) {
    return;
  }

  tool.onClick?.(toolContext);
}
