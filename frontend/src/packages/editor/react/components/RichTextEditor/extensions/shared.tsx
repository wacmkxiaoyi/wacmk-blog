import React from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import type { ContextActionGroup } from "../../../../../context-actions/core/types.ts";
import { AddIcon, DeleteIcon } from "../../../icons/index.ts";
import {
  findTabItemPosByKey,
  insertTabIntoTabs,
  deleteCurrentBlock,
  deleteNodeAtPos,
  insertParagraphBelow,
  isVisualIndentAvailable,
  runVisualIndent,
} from "../helpers/richTextEditorRuntime.ts";
import { createDefaultTab } from "../helpers/customBlockHelpers.ts";

export function createEditorBlockNode(
  name: string,
  config: Record<string, unknown> = {},
) {
  return Node.create({
    ...(config || {}),
    name,
  });
}

export function renderNodeTag(
  tag: string,
  HTMLAttributes: Record<string, unknown>,
  dataEditorNode: string,
) {
  return [
    tag,
    mergeAttributes(HTMLAttributes, { "data-editor-node": dataEditorNode }),
  ];
}

export function buildBlockContextMenuGroups(
  editor,
  translate,
): ContextActionGroup[] {
  const canIncreaseIndent = isVisualIndentAvailable(editor, "in");
  const canDecreaseIndent = isVisualIndentAvailable(editor, "out");

  return [
    {
      group: 0,
      children: [
        {
          key: "indent-in",
          label: translate("editor.context.increaseIndent", "Increase indent"),
          icon: <AddIcon />,
          disabled: !canIncreaseIndent,
          onClick: () => runVisualIndent(editor, "in"),
        },
        {
          key: "indent-out",
          label: translate("editor.context.decreaseIndent", "Decrease indent"),
          icon: <DeleteIcon />,
          disabled: !canDecreaseIndent,
          onClick: () => runVisualIndent(editor, "out"),
        },
      ],
    },
    {
      group: 999,
      children: [
        {
          key: "add-paragraph-below",
          label: translate(
            "editor.context.addParagraphBelow",
            "Add a paragraph below",
          ),
          icon: <AddIcon />,
          onClick: () => insertParagraphBelow(editor),
        },
        {
          key: "delete-current-block",
          label: translate("editor.context.delete", "Delete"),
          icon: <DeleteIcon />,
          danger: true,
          onClick: () => deleteCurrentBlock(editor),
        },
      ],
    },
  ];
}

export function buildTabsContextMenuGroups({
  editor,
  translate,
  tabsNode,
  tabsPos,
  target,
}: {
  editor: unknown;
  translate: (key: string, fallback: string) => string;
  tabsNode: any;
  tabsPos: number;
  target: HTMLElement | null;
}): ContextActionGroup[] {
  if (!tabsNode || typeof tabsPos !== "number") {
    return [];
  }

  const tabKey =
    target
      ?.closest("[data-editor-tab-key]")
      ?.getAttribute("data-editor-tab-key") || null;
  const currentTabPos = findTabItemPosByKey(tabsNode, tabsPos, tabKey);

  return [
    {
      group: 11,
      children: [
        {
          key: "tabs-add",
          label: translate("editor.context.addTab", "Add tab"),
          icon: <AddIcon />,
          onClick: () => {
            const index = (tabsNode.childCount || 0) + 1;
            const tab = createDefaultTab(
              index,
              translate("editor.default.tabLabel", "Tab {index}"),
            );
            insertTabIntoTabs(editor, tabsPos, tab.key, tab.label);
          },
        },
        ...(tabKey
          ? [
              {
                key: "tabs-delete",
                label: translate("editor.context.deleteTab", "Delete tab"),
                icon: <DeleteIcon />,
                danger: true,
                disabled: currentTabPos == null,
                onClick: () => {
                  if (currentTabPos != null) {
                    deleteNodeAtPos(editor, currentTabPos);
                  }
                },
              },
            ]
          : []),
      ],
    },
  ];
}
