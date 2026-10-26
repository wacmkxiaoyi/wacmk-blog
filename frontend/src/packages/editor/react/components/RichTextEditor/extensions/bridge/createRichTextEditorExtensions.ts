import StarterKit from "@tiptap/starter-kit";
import { Extension } from "@tiptap/core";
import Heading from "@tiptap/extension-heading";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import type { CreateRichTextEditorExtensionsArgs } from "../../helpers/types.ts";
import { createStableHeadingId } from "../../../../../core/bridges.ts";
import { buildUniqueTabItems } from "../../helpers/richTextEditorRuntime.ts";
import { createColorTokenMark } from "../marks/colorTokenMark.ts";
import { createCodeBlockNode } from "../nodes/codeBlockNode.tsx";
import {
  createInlineMathNode,
  createMathBlockNode,
} from "../nodes/mathNodes.tsx";
import {
  createAdmonitionBlockNode,
  createAnchorBlockNode,
  createCustomBlockNode,
  createImageBlockNode,
  createTabItemNode,
  createTabsBlockNode,
  createVideoBlockNode,
} from "../nodes/blockNodes.tsx";

function syncHeadingIdsInTransaction(transaction) {
  if (!transaction?.docChanged || transaction.getMeta("editorHeadingIdSync")) {
    return false;
  }

  const usedIds = new Set<string>();
  let changed = false;

  transaction.doc.descendants((node, pos) => {
    if (node.type.name !== "heading") {
      return true;
    }

    const currentId =
      typeof node.attrs?.id === "string" && node.attrs.id.trim()
        ? String(node.attrs.id)
        : "";
    const nextId = createStableHeadingId(node.textContent || "", usedIds);
    if (currentId === nextId) {
      return true;
    }

    transaction.setNodeMarkup(
      pos,
      undefined,
      { ...(node.attrs || {}), id: nextId },
      node.marks,
    );
    changed = true;
    return true;
  });

  if (changed) {
    transaction.setMeta("editorHeadingIdSync", true);
  }

  return changed;
}

function syncTabKeysInTransaction(transaction) {
  if (!transaction?.docChanged || transaction.getMeta("editorTabKeySync")) {
    return false;
  }

  let changed = false;
  transaction.doc.descendants((node, pos) => {
    if (node.type.name !== "tabsBlock") {
      return true;
    }

    const items = [];
    node.forEach((child) => items.push(child));
    const normalized = buildUniqueTabItems(items);
    let offset = 0;

    normalized.forEach((item, index) => {
      const child = items[index];
      const currentKey = String(child?.attrs?.key || "");
      const currentLabel = String(child?.attrs?.label || "");
      if (currentKey === item.key && currentLabel === item.label) {
        offset += child.nodeSize;
        return;
      }

      transaction.setNodeMarkup(
        pos + offset + 1,
        undefined,
        { ...item.attrs, key: item.key, label: item.label },
        child.marks,
      );
      offset += child.nodeSize;
      changed = true;
    });

    return true;
  });

  if (changed) {
    transaction.setMeta("editorTabKeySync", true);
  }

  return changed;
}

export function normalizeEditorHeadingIds(editorDoc) {
  const usedIds = new Set<string>();

  function visit(node) {
    if (!node || typeof node !== "object") {
      return node;
    }

    const nextContent = Array.isArray(node.content)
      ? node.content.map(visit)
      : node.content;
    if (node.type !== "heading") {
      return nextContent === node.content
        ? node
        : { ...node, content: nextContent };
    }

    const text = Array.isArray(nextContent)
      ? nextContent
          .map((child) =>
            child?.type === "text"
              ? String(child.text || "")
              : child?.type === "hardBreak"
                ? "\n"
                : "",
          )
          .join("")
      : "";
    const id = createStableHeadingId(text, usedIds);

    return {
      ...node,
      attrs: {
        ...(node.attrs || {}),
        id,
      },
      content: nextContent,
    };
  }

  return visit(editorDoc);
}

export function createRichTextEditorExtensions({
  labelsRef,
  bridgeRef,
  customBlockRegistryRef,
}: CreateRichTextEditorExtensionsArgs) {
  const heading = Heading.extend({
    addAttributes() {
      return {
        ...(this.parent?.() || {}),
        id: {
          default: null,
          parseHTML: (element) => element.getAttribute("id"),
          renderHTML: (attributes) =>
            attributes.id ? { id: attributes.id } : {},
        },
      };
    },
  });

  const headingIdSync = Extension.create({
    name: "editorHeadingIdSync",
    dispatchTransaction({ transaction, next }) {
      syncHeadingIdsInTransaction(transaction);
      syncTabKeysInTransaction(transaction);
      next(transaction);
    },
  });

  return [
    StarterKit.configure({
      codeBlock: false,
      heading: false,
    }),
    headingIdSync,
    heading,
    createCodeBlockNode(labelsRef).configure({
      defaultLanguage: "text",
      enableTabIndentation: true,
      exitOnTripleEnter: false,
      exitOnArrowDown: true,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
    }),
    TextStyle,
    Underline,
    createColorTokenMark(),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    createInlineMathNode(bridgeRef),
    createMathBlockNode(bridgeRef),
    createAnchorBlockNode(bridgeRef),
    createAdmonitionBlockNode(bridgeRef),
    createTabItemNode(bridgeRef),
    createTabsBlockNode(bridgeRef),
    createImageBlockNode(bridgeRef),
    createVideoBlockNode(bridgeRef),
    createCustomBlockNode(bridgeRef, customBlockRegistryRef),
  ];
}
