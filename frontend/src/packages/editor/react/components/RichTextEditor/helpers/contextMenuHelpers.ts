import type {
  EditorResolvedContextNode,
  EditorToolContextMenuContext,
  EditorToolDefinition,
} from "../../../../core/types.ts";

export function syncSelectionToContextTarget(
  editor,
  event: MouseEvent,
  shouldPreserveSelectionOnContextMenu: (
    editor: unknown,
    pos?: number | null,
  ) => boolean,
) {
  const view = editor?.view;
  if (!view) {
    return null;
  }

  const position = view.posAtCoords({
    left: event.clientX,
    top: event.clientY,
  });
  if (!position || typeof position.pos !== "number") {
    return null;
  }

  if (shouldPreserveSelectionOnContextMenu(editor, position.pos)) {
    return position.pos;
  }

  editor.commands.setTextSelection(position.pos);
  return position.pos;
}

export function resolveToolContextNode(
  editor,
  eventTarget: EventTarget | null,
  selection,
  tool: EditorToolDefinition,
  helpers: {
    getContextLinkData: (
      editor: unknown,
      target: EventTarget | null,
    ) => Record<string, unknown> | null;
    resolveContextNode: (
      editor: unknown,
      target: EventTarget | null,
      element: Element | null,
      typeNames: string[],
      selection: unknown,
    ) => EditorResolvedContextNode | null;
  },
) {
  if (!tool.contextNodeTypes?.length) {
    return null;
  }

  const target = eventTarget instanceof HTMLElement ? eventTarget : null;
  const attributeMap = {
    admonitionBlock: "[data-editor-node-type='admonitionBlock']",
    tabsBlock: "[data-editor-node-type='tabsBlock']",
    imageBlock: "[data-editor-node-type='imageBlock']",
    videoBlock: "[data-editor-node-type='videoBlock']",
    customBlock: "[data-editor-node-type='customBlock']",
    codeBlock: "[data-editor-node-type='codeBlock']",
    table: "table",
    link: "a[href]",
  };

  for (const typeName of tool.contextNodeTypes) {
    if (typeName === "table") {
      const tableTarget =
        eventTarget instanceof HTMLElement
          ? eventTarget.closest("td,th")
          : null;
      if (tableTarget && editor?.isActive?.("table")) {
        return {
          pos: 0,
          node: { attrs: {}, type: "table" },
        } as EditorResolvedContextNode;
      }
      continue;
    }
    if (typeName === "link") {
      const linkData = helpers.getContextLinkData(editor, eventTarget);
      if (linkData) {
        return {
          pos: linkData.from as number,
          node: { attrs: linkData, type: "link" },
        } as EditorResolvedContextNode;
      }
      continue;
    }
    const selector = attributeMap[typeName];
    const element = selector ? target?.closest?.(selector) || null : null;
    const resolved = helpers.resolveContextNode(
      editor,
      eventTarget,
      element,
      [typeName],
      selection,
    );
    if (resolved?.node) {
      return resolved as EditorResolvedContextNode;
    }
  }

  return null;
}

export function buildToolContextMenuGroups(
  tool: EditorToolDefinition,
  context: EditorToolContextMenuContext,
) {
  if (typeof tool.getContextMenuGroups !== "function") {
    return [];
  }
  return tool.getContextMenuGroups(context) || [];
}
