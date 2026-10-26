import type { EditorToolDefinition } from "./types.ts";

export function createEditorTool(tool: EditorToolDefinition) {
  return tool;
}

export function sortEditorTools(tools: EditorToolDefinition[]) {
  return [...tools].sort((left, right) => {
    if (left.group !== right.group) {
      return left.group - right.group;
    }
    return (left.order || 0) - (right.order || 0);
  });
}

export function indexEditorTools(tools: EditorToolDefinition[]) {
  return sortEditorTools(tools).reduce<Record<string, EditorToolDefinition>>(
    (result, tool) => {
      result[tool.key] = tool;
      return result;
    },
    {},
  );
}

export function indexCustomBlockTools(tools: EditorToolDefinition[]) {
  return sortEditorTools(tools).reduce<Record<string, EditorToolDefinition>>(
    (result, tool) => {
      if (tool.customBlock?.kind) {
        result[tool.customBlock.kind] = tool;
      }
      return result;
    },
    {},
  );
}

export function canExecuteToolInMarkdown(tool: EditorToolDefinition) {
  if (tool.key === "markdown") {
    return true;
  }
  return Boolean(
    tool.markdownInsert ||
    tool.executeMarkdown ||
    tool.customBlock ||
    tool.onClick,
  );
}
