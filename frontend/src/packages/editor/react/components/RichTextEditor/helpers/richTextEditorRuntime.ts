import React from "react";
import { Selection, TextSelection } from "@tiptap/pm/state";
import contentRendererStyles from "../../../../../content-renderer/react/components/ContentRenderer/ContentRenderer.module.css";
import {
  buildHeadingSlug,
  contentDocumentToEditorDoc,
  editorDocToContentDocument,
} from "../../../../core/bridges.ts";
import { createDefaultTab } from "./customBlockHelpers.ts";
import styles from "../RichTextEditor.module.css";

export function clampEditorHeight(
  height: number,
  minHeight: number,
  maxHeight: number,
) {
  return Math.min(maxHeight, Math.max(minHeight, height));
}

export function focusElementWithoutScroll(element) {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  try {
    element.focus({ preventScroll: true });
  } catch (_error) {
    element.focus();
  }
}

export function useLatest<T>(value: T) {
  const ref = React.useRef(value);
  ref.current = value;
  return ref;
}

export function createInlinePalettePosition(
  anchor,
  fallbackRect,
  panelRect,
  containerRect,
) {
  if (!anchor && !fallbackRect) {
    return null;
  }
  const rect = anchor?.getBoundingClientRect?.() || fallbackRect;
  if (!rect) {
    return null;
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 8;
  const panelWidth = panelRect?.width || 0;
  const panelHeight = panelRect?.height || 0;
  const maxLeft = Math.max(margin, viewportWidth - panelWidth - margin);
  const left = Math.min(Math.max(margin, rect.left), maxLeft);
  const top =
    panelHeight && rect.bottom + margin + panelHeight > viewportHeight
      ? Math.max(margin, rect.top - panelHeight - margin)
      : rect.bottom + margin;

  return {
    top: top - (containerRect?.top || 0),
    left: left - (containerRect?.left || 0),
  };
}

export function runEditorCommandWithoutScroll(
  editor,
  command: () => boolean | void,
) {
  if (!editor) {
    return false;
  }

  let handled = false;
  preserveSurfaceScroll(getEditorSurfaceElement(editor), () => {
    handled = command() !== false;
  });
  return handled;
}

export function buildEditorShellClassName() {
  return `${contentRendererStyles.renderer} ${contentRendererStyles["mode-article"]} ${styles.editorContentBody}`;
}

export function isClickBelowEditorContent(view, clientY) {
  const lastChild = view?.dom?.lastElementChild;
  if (typeof lastChild?.getBoundingClientRect !== "function") {
    return false;
  }

  return clientY > lastChild.getBoundingClientRect().bottom;
}

export function placeCaretWhenClickingBelowEditorContent(view, event) {
  if (event.button !== 0) {
    return false;
  }

  if (isCanonicalEmptyEditorDocument(view?.state?.doc)) {
    event.preventDefault();
    event.stopPropagation();
    return placeCaretInEmptyEditor(view);
  }

  if (!isClickBelowEditorContent(view, event.clientY)) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  return moveEditorCaretToEnd(view);
}

export function isCanonicalEmptyEditorDocument(doc) {
  if (doc?.childCount === 0) {
    return true;
  }

  const paragraph = doc?.firstChild;
  return (
    doc?.childCount === 1 &&
    paragraph?.type?.name === "paragraph" &&
    paragraph.content.size === 0
  );
}

function placeCaretInEmptyEditor(view) {
  if (view?.state?.doc?.childCount === 0) {
    const paragraph = view.state.schema?.nodes?.paragraph?.create?.();
    if (!paragraph || typeof view.dispatch !== "function") {
      return false;
    }

    const transaction = view.state.tr.insert(0, paragraph);
    transaction.setSelection(TextSelection.create(transaction.doc, 1));
    view.dispatch(transaction);
    view.focus?.();
    return true;
  }

  return moveEditorCaretToStart(view);
}

export function moveEditorCaretToStart(view) {
  if (!view?.state?.doc || typeof view.dispatch !== "function") {
    return false;
  }

  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)),
  );
  view.focus?.();
  return true;
}

export function moveEditorCaretToEnd(view) {
  if (!view?.state?.doc || typeof view.dispatch !== "function") {
    return false;
  }

  view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)));
  view.focus?.();
  return true;
}

export function getSelectedMarkdown(textarea) {
  return textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
}

export function replaceTextareaSelection(
  textarea,
  nextText,
  selectOffset,
  selectLength,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const currentValue = textarea.value;
  const value = `${currentValue.slice(0, start)}${nextText}${currentValue.slice(end)}`;
  textarea.value = value;
  const nextStart = start + (selectOffset || 0);
  const length = selectLength == null ? 0 : selectLength;
  textarea.setSelectionRange(nextStart, nextStart + length);
  scrollTextareaSelectionIntoView(textarea);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function copyTextareaSizingStyle(textarea, target) {
  const computed = window.getComputedStyle(textarea);
  [
    "boxSizing",
    "width",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "fontFamily",
    "fontSize",
    "fontStyle",
    "fontWeight",
    "fontStretch",
    "fontVariant",
    "lineHeight",
    "letterSpacing",
    "textTransform",
    "textIndent",
    "textDecoration",
    "tabSize",
    "whiteSpace",
    "wordBreak",
    "overflowWrap",
  ].forEach((property) => {
    target.style[property] = computed[property];
  });
}

function escapeMirrorHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n$/g, "\n\u200b")
    .replace(/\n/g, "<br />")
    .replace(/ {2}/g, " &nbsp;");
}

export function scrollTextareaSelectionIntoView(textarea) {
  if (
    !(textarea instanceof HTMLTextAreaElement) ||
    typeof document === "undefined"
  ) {
    return;
  }

  const selectionStart = textarea.selectionStart ?? 0;
  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  mirror.setAttribute("aria-hidden", "true");
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.zIndex = "-1";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordBreak = "break-word";
  mirror.style.overflowWrap = "break-word";

  copyTextareaSizingStyle(textarea, mirror);

  const before = escapeMirrorHtml(textarea.value.slice(0, selectionStart));
  const after =
    escapeMirrorHtml(textarea.value.slice(selectionStart)) || "\u200b";
  mirror.innerHTML = `${before}<span data-editor-caret="true">\u200b</span>${after}`;
  document.body.appendChild(mirror);

  const caret = mirror.querySelector("[data-editor-caret='true']");
  const caretTop = caret instanceof HTMLElement ? caret.offsetTop : 0;
  const caretHeight =
    caret instanceof HTMLElement
      ? Math.max(caret.offsetHeight, parseFloat(computed.lineHeight) || 16)
      : parseFloat(computed.lineHeight) || 16;

  document.body.removeChild(mirror);

  const viewportTop = textarea.scrollTop;
  const viewportBottom = viewportTop + textarea.clientHeight;
  const caretBottom = caretTop + caretHeight;

  if (caretTop < viewportTop) {
    textarea.scrollTop = Math.max(0, caretTop);
    return;
  }

  if (caretBottom > viewportBottom) {
    textarea.scrollTop = Math.max(0, caretBottom - textarea.clientHeight);
  }
}

function getTextareaSelectedLines(textarea) {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const lineEndIndex = value.indexOf("\n", end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  return {
    lineStart,
    lineEnd,
    selectedText: value.slice(lineStart, lineEnd),
  };
}

export function indentPlainTextareaSelection(
  textarea,
  direction: "in" | "out",
  prefix = "    ",
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;

  if (start === end) {
    if (direction === "in") {
      replaceTextareaSelection(textarea, prefix, prefix.length, 0);
      return;
    }

    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const beforeCursor = value.slice(lineStart, start);
    let removeLength = 0;
    if (beforeCursor.endsWith(prefix)) {
      removeLength = prefix.length;
    } else {
      const spaces = beforeCursor.match(/ {1,4}$/)?.[0] || "";
      removeLength = spaces.length || (beforeCursor.endsWith("\t") ? 1 : 0);
    }
    if (!removeLength) {
      return;
    }
    textarea.value = `${value.slice(0, start - removeLength)}${value.slice(start)}`;
    const nextCursor = start - removeLength;
    textarea.setSelectionRange(nextCursor, nextCursor);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  const { lineStart, lineEnd, selectedText } =
    getTextareaSelectedLines(textarea);
  const lines = selectedText.split("\n");
  const nextLines =
    direction === "in"
      ? lines.map((line) => `${prefix}${line}`)
      : lines.map((line) => {
          if (line.startsWith(prefix)) {
            return line.slice(prefix.length);
          }
          if (line.startsWith("\t")) {
            return line.slice(1);
          }
          if (line.startsWith("    ")) {
            return line.slice(4);
          }
          if (line.startsWith("  ")) {
            return line.slice(2);
          }
          return line.replace(/^\s/, "");
        });

  const nextText = nextLines.join("\n");
  textarea.value = `${value.slice(0, lineStart)}${nextText}${value.slice(lineEnd)}`;
  const removedOnFirstLine =
    direction === "out"
      ? Math.max(0, (lines[0] || "").length - (nextLines[0] || "").length)
      : 0;
  const nextSelectionStart =
    direction === "in"
      ? start + prefix.length
      : Math.max(lineStart, start - removedOnFirstLine);
  const nextSelectionEnd = lineStart + nextText.length;
  textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

export function indentMarkdownLines(textarea, direction: "in" | "out") {
  indentPlainTextareaSelection(textarea, direction, "    ");
}

export function preserveSurfaceScroll(surface, callback) {
  if (!(surface instanceof HTMLElement)) {
    callback();
    return;
  }

  const top = surface.scrollTop;
  const left = surface.scrollLeft;
  const restore = () => {
    surface.scrollTop = top;
    surface.scrollLeft = left;
  };
  callback();
  restore();
  window.requestAnimationFrame(() => {
    restore();
    window.requestAnimationFrame(restore);
  });
}

function getEditorScrollViewport(editor) {
  const contentRoot = editor?.view?.dom?.closest?.(`.${styles.root}`);
  if (!(contentRoot instanceof HTMLElement)) {
    return getEditorSurfaceElement(editor);
  }

  const navigationViewport = contentRoot.querySelector(
    `.${styles.navigationContentViewport}`,
  );
  if (
    navigationViewport instanceof HTMLElement &&
    navigationViewport.offsetParent !== null
  ) {
    return navigationViewport;
  }

  return getEditorSurfaceElement(editor);
}

function scrollRectIntoContainer(container: HTMLElement, rect: DOMRect) {
  const containerRect = container.getBoundingClientRect();
  const topOffset = rect.top - containerRect.top;
  const bottomOffset = rect.bottom - containerRect.top;

  if (topOffset < 0) {
    container.scrollTop += topOffset;
  } else if (bottomOffset > container.clientHeight) {
    container.scrollTop += bottomOffset - container.clientHeight;
  }

  const leftOffset = rect.left - containerRect.left;
  const rightOffset = rect.right - containerRect.left;
  if (leftOffset < 0) {
    container.scrollLeft += leftOffset;
  } else if (rightOffset > container.clientWidth) {
    container.scrollLeft += rightOffset - container.clientWidth;
  }
}

export function scrollEditorSelectionIntoView(editor) {
  const container = getEditorScrollViewport(editor);
  const view = editor?.view;
  const selection = editor?.state?.selection;
  if (!(container instanceof HTMLElement) || !view || !selection) {
    return;
  }

  const domSelection =
    typeof window !== "undefined" ? window.getSelection() : null;
  const range =
    domSelection && domSelection.rangeCount > 0
      ? domSelection.getRangeAt(0)
      : null;
  const fallbackRect = view.coordsAtPos(selection.to);
  const rect = range?.getBoundingClientRect?.();
  const resolvedRect =
    rect && (rect.width || rect.height)
      ? rect
      : new DOMRect(
          fallbackRect.left,
          fallbackRect.top,
          Math.max(1, fallbackRect.right - fallbackRect.left),
          Math.max(1, fallbackRect.bottom - fallbackRect.top),
        );

  scrollRectIntoContainer(container, resolvedRect);
}

export function runEditorCommandFollowingCaret(
  editor,
  command: () => boolean | void,
) {
  if (!editor) {
    return false;
  }

  const handled = command() !== false;
  if (!handled) {
    return false;
  }

  if (typeof window === "undefined") {
    return true;
  }

  window.requestAnimationFrame(() => {
    scrollEditorSelectionIntoView(editor);
  });
  return true;
}

export function getEditorSurfaceElement(editor) {
  return editor?.view?.dom?.closest?.(`.${styles.surface}`) || null;
}

function dispatchWithoutScroll(editor, transaction) {
  const surface = getEditorSurfaceElement(editor);
  preserveSurfaceScroll(surface, () => editor.view.dispatch(transaction));
  return true;
}

export function setNodeAttrsAtPos(editor, pos, attrs) {
  if (typeof pos !== "number") {
    return false;
  }
  const node = editor?.state?.doc?.nodeAt?.(pos);
  if (!node || node.isText) {
    return false;
  }

  const nextAttrs = { ...(node.attrs || {}), ...(attrs || {}) };
  const transaction = editor.state.tr.setNodeMarkup(
    pos,
    undefined,
    nextAttrs,
    node.marks,
  );
  return dispatchWithoutScroll(editor, transaction);
}

export function findTabItemPosByKey(tabsNode, tabsPos, key) {
  if (!tabsNode || typeof tabsPos !== "number" || !key) {
    return null;
  }

  let foundPos = null;
  tabsNode.forEach((child, offset) => {
    if (foundPos != null) {
      return;
    }
    if (String(child.attrs?.key || "") === String(key)) {
      foundPos = tabsPos + offset + 1;
    }
  });
  return foundPos;
}

export function buildUniqueTabItems(tabItems) {
  const usedKeys = new Set();
  return (tabItems || []).map((item, index) => {
    const attrs =
      item?.attrs && typeof item.attrs === "object" ? item.attrs : {};
    const baseKey = String(attrs.key || `tab-${index + 1}`);
    let nextKey = baseKey;
    let suffix = 2;
    while (usedKeys.has(nextKey)) {
      nextKey = `${baseKey}-${suffix}`;
      suffix += 1;
    }
    usedKeys.add(nextKey);
    return {
      index,
      key: nextKey,
      label: String(attrs.label || ""),
      attrs,
      node: item,
    };
  });
}

export function normalizeTabsBlockNodeAttrs(editor, tabsPos) {
  if (!editor || typeof tabsPos !== "number") {
    return false;
  }

  const tabsNode = editor.state.doc.nodeAt(tabsPos);
  if (!tabsNode || tabsNode.type?.name !== "tabsBlock") {
    return false;
  }

  const items = [];
  tabsNode.forEach((child) => items.push(child));
  const normalized = buildUniqueTabItems(items);
  let changed = false;
  const transaction = editor.state.tr;

  normalized.forEach((item, index) => {
    const child = items[index];
    const currentKey = String(child?.attrs?.key || "");
    const currentLabel = String(child?.attrs?.label || "");
    if (currentKey === item.key && currentLabel === item.label) {
      return;
    }
    changed = true;
  });

  if (!changed) {
    return false;
  }

  let offset = 0;
  normalized.forEach((item, index) => {
    const child = items[index];
    const childPos = tabsPos + offset + 1;
    offset += child.nodeSize;
    transaction.setNodeMarkup(
      childPos,
      undefined,
      { ...item.attrs, key: item.key, label: item.label },
      child.marks,
    );
  });

  return dispatchWithoutScroll(editor, transaction);
}

export function deleteNodeAtPos(editor, pos) {
  if (typeof pos !== "number") {
    return false;
  }
  const node = editor?.state?.doc?.nodeAt?.(pos);
  if (!node) {
    return false;
  }
  const transaction = editor.state.tr.delete(pos, pos + node.nodeSize);
  return dispatchWithoutScroll(editor, transaction);
}

function resolveOuterBlockSelection(editor, typeNames) {
  const selection = editor?.state?.selection;
  if (!selection?.$from) {
    return null;
  }
  return findParentNode(selection, typeNames);
}

function resolveCurrentTextBlock(selection) {
  if (!selection?.$from) {
    return null;
  }

  for (let depth = selection.$from.depth; depth >= 0; depth -= 1) {
    const node = selection.$from.node(depth);
    if (!node?.isBlock) {
      continue;
    }
    if (
      [
        "doc",
        "bulletList",
        "orderedList",
        "taskList",
        "listItem",
        "taskItem",
        "tabItem",
      ].includes(node.type.name)
    ) {
      continue;
    }
    return {
      node,
      depth,
      pos: depth > 0 ? selection.$from.before(depth) : 0,
    };
  }

  return null;
}

function resolveCurrentDeleteBlock(selection) {
  if (!selection?.$from) {
    return null;
  }

  const containerNode = findParentNode(selection, [
    "admonitionBlock",
    "tabsBlock",
    "table",
    "blockquote",
    "listItem",
    "taskItem",
  ]);
  if (containerNode?.node) {
    return containerNode;
  }

  for (let depth = selection.$from.depth; depth >= 0; depth -= 1) {
    const node = selection.$from.node(depth);
    if (!node?.isBlock || node.type.name === "doc") {
      continue;
    }
    if (
      [
        "bulletList",
        "orderedList",
        "taskList",
        "tabItem",
        "tableRow",
        "tableCell",
        "tableHeader",
      ].includes(node.type.name)
    ) {
      continue;
    }
    return {
      node,
      depth,
      pos: depth > 0 ? selection.$from.before(depth) : 0,
    };
  }

  return null;
}

export function insertParagraphBelow(editor) {
  const state = editor?.state;
  const selection = state?.selection;
  const paragraphType = state?.schema?.nodes?.paragraph;
  if (!editor || !selection || !paragraphType) {
    return false;
  }

  let targetPos = null;
  let targetNode = null;

  if (selection.node?.isBlock) {
    const selectedNodePos =
      typeof selection.from === "number" ? selection.from : null;
    const selectedNode =
      selectedNodePos != null ? state.doc.nodeAt(selectedNodePos) : null;
    if (selectedNode?.isBlock) {
      targetPos = selectedNodePos;
      targetNode = selectedNode;
    }
  }

  if (!targetNode) {
    const outerBlock = resolveOuterBlockSelection(editor, [
      "admonitionBlock",
      "tabsBlock",
    ]);
    if (outerBlock?.node) {
      targetPos = outerBlock.pos;
      targetNode = outerBlock.node;
    }
  }

  if (!targetNode) {
    const currentBlock = resolveCurrentTextBlock(selection);
    if (currentBlock?.node) {
      targetPos = currentBlock.pos;
      targetNode = currentBlock.node;
    }
  }

  if (!targetNode || typeof targetPos !== "number") {
    return false;
  }

  const insertPos = targetPos + targetNode.nodeSize;
  const paragraph = paragraphType.create();
  const transaction = state.tr.insert(insertPos, paragraph);
  const resolvedPos = transaction.doc.resolve(insertPos + 1);
  transaction.setSelection(Selection.near(resolvedPos));
  editor.view.dispatch(transaction);
  if (typeof window !== "undefined") {
    window.requestAnimationFrame(() => {
      scrollEditorSelectionIntoView(editor);
    });
  }
  return true;
}

export function deleteCurrentBlock(editor) {
  const state = editor?.state;
  const selection = state?.selection;
  if (!editor || !selection) {
    return false;
  }

  let targetPos = null;
  let targetNode = null;

  if (selection.node?.isBlock) {
    const selectedNodePos =
      typeof selection.from === "number" ? selection.from : null;
    const selectedNode =
      selectedNodePos != null ? state.doc.nodeAt(selectedNodePos) : null;
    if (selectedNode?.isBlock) {
      targetPos = selectedNodePos;
      targetNode = selectedNode;
    }
  }

  if (!targetNode) {
    const currentBlock = resolveCurrentDeleteBlock(selection);
    if (currentBlock?.node) {
      targetPos = currentBlock.pos;
      targetNode = currentBlock.node;
    }
  }

  if (!targetNode || typeof targetPos !== "number") {
    return false;
  }

  const transaction = state.tr.delete(
    targetPos,
    targetPos + targetNode.nodeSize,
  );
  return dispatchWithoutScroll(editor, transaction);
}

export function insertTabIntoTabs(
  editor,
  tabsPos,
  key = createDefaultTab().key,
  label = "",
) {
  const tabsNode = editor?.state?.doc?.nodeAt?.(tabsPos);
  if (!tabsNode || tabsNode.type?.name !== "tabsBlock") {
    return false;
  }

  const tabItem = editor.state.schema.nodes.tabItem?.create({ key, label }, [
    editor.state.schema.nodes.paragraph.create(),
  ]);
  if (!tabItem) {
    return false;
  }

  const insertPos = tabsPos + tabsNode.nodeSize - 1;
  const transaction = editor.state.tr.insert(insertPos, tabItem);
  return dispatchWithoutScroll(editor, transaction);
}

export function getContextLinkData(editor, target) {
  if (!editor || !(target instanceof HTMLElement)) {
    return null;
  }

  const anchor = target.closest("a[href]");
  if (!anchor) {
    return null;
  }

  const selection = editor.state.selection;
  const linkAttrs = editor.getAttributes?.("link") || {};
  if (editor.isActive?.("link") && linkAttrs.href) {
    return {
      href: String(linkAttrs.href || ""),
      title: String(linkAttrs.title || ""),
      label: editor.state.doc.textBetween(selection.from, selection.to, " "),
      from: selection.from,
      to: selection.to,
    };
  }

  const pos = editor.view.posAtDOM(anchor, 0);
  const $pos = editor.state.doc.resolve(pos);
  const nodeAfter = $pos.nodeAfter;
  const mark =
    nodeAfter?.marks?.find?.((entry) => entry.type.name === "link") || null;
  if (!mark?.attrs?.href) {
    return null;
  }

  return {
    href: String(mark.attrs.href || ""),
    title: String(mark.attrs.title || ""),
    label: anchor.textContent || "",
    from: pos,
    to: pos + Math.max(1, nodeAfter?.nodeSize || 1),
  };
}

function findParentNode(selection, names) {
  for (let depth = selection.$from.depth; depth >= 0; depth -= 1) {
    const node = selection.$from.node(depth);
    if (node && names.includes(node.type.name)) {
      return {
        node,
        depth,
        pos: depth > 0 ? selection.$from.before(depth) : 0,
      };
    }
  }
  return null;
}

function getNodePosFromElement(editor, element, typeNames) {
  const view = editor?.view;
  if (!view || !element) {
    return null;
  }

  let pos = null;
  try {
    pos = view.posAtDOM(element, 0);
  } catch (_error) {
    return null;
  }

  if (typeof pos !== "number" || pos < 0 || pos > view.state.doc.content.size) {
    return null;
  }

  let resolved = null;
  try {
    resolved = view.state.doc.resolve(pos);
  } catch (_error) {
    return null;
  }

  for (let depth = resolved.depth; depth >= 0; depth -= 1) {
    const node = resolved.node(depth);
    if (node && typeNames.includes(node.type.name)) {
      return depth > 0 ? resolved.before(depth) : 0;
    }
  }
  return null;
}

function getNodePosFromTargetAncestry(editor, target, stopElement, typeNames) {
  const view = editor?.view;
  if (!view || !(target instanceof Node)) {
    return null;
  }

  let current = target instanceof HTMLElement ? target : target.parentElement;
  while (current) {
    const pos = getNodePosFromElement(editor, current, typeNames);
    if (typeof pos === "number") {
      return pos;
    }
    if (current === stopElement) {
      break;
    }
    current = current.parentElement;
  }

  return stopElement
    ? getNodePosFromElement(editor, stopElement, typeNames)
    : null;
}

export function resolveContextNode(
  editor,
  target,
  element,
  typeNames,
  selection,
) {
  const pos = getNodePosFromTargetAncestry(editor, target, element, typeNames);
  if (typeof pos === "number") {
    const node = editor?.state?.doc?.nodeAt?.(pos);
    if (node) {
      return { pos, node };
    }
  }
  return findParentNode(selection, typeNames);
}

function getTopLevelSelectionRange(editor) {
  const selection = editor?.state?.selection;
  const doc = editor?.state?.doc;
  if (!selection || !doc) {
    return null;
  }

  const entries = [];
  doc.forEach((node, offset, index) => {
    const from = offset;
    const to = offset + node.nodeSize;
    if (selection.to <= from || selection.from >= to) {
      return;
    }
    entries.push({ index, node, pos: offset });
  });

  if (!entries.length) {
    return null;
  }

  return {
    startIndex: entries[0].index,
    endIndex: entries[entries.length - 1].index,
    entries,
  };
}

function canNestSelectedBlocksUnderPreviousList(editor) {
  const range = getTopLevelSelectionRange(editor);
  const blocks = editorDocToContentDocument(editor?.getJSON?.()).children || [];
  if (!range || range.startIndex <= 0) {
    return false;
  }

  if (
    range.entries.some((entry) => {
      const previousEntry = range.entries.find(
        (candidate) => candidate.index === entry.index - 1,
      );
      return !previousEntry && entry.index > range.startIndex;
    })
  ) {
    return false;
  }

  const previousBlock = blocks[range.startIndex - 1];
  if (
    !previousBlock ||
    previousBlock.type !== "list" ||
    !Array.isArray(previousBlock.items) ||
    !previousBlock.items.length
  ) {
    return false;
  }

  return range.entries.every(
    (entry) => entry?.node?.type?.name !== "horizontalRule",
  );
}

function nestSelectedBlocksUnderPreviousList(editor) {
  const range = getTopLevelSelectionRange(editor);
  const document = editorDocToContentDocument(editor?.getJSON?.());
  const blocks = Array.isArray(document.children) ? [...document.children] : [];
  if (!range || range.startIndex <= 0) {
    return false;
  }

  const previousBlock = blocks[range.startIndex - 1];
  if (
    !previousBlock ||
    previousBlock.type !== "list" ||
    !Array.isArray(previousBlock.items) ||
    !previousBlock.items.length
  ) {
    return false;
  }

  const selectedBlocks = blocks.slice(range.startIndex, range.endIndex + 1);
  if (!selectedBlocks.length) {
    return false;
  }

  const lastItem = previousBlock.items[previousBlock.items.length - 1];
  lastItem.children = [...(lastItem.children || []), ...selectedBlocks];
  blocks.splice(range.startIndex, selectedBlocks.length);

  editor.commands.setContent(
    addIndentAttributesToJsonNode(
      contentDocumentToEditorDoc({
        ...document,
        children: blocks,
      }),
    ),
    false,
  );
  return true;
}

function getSelectionListContinuationIndex(editor, currentListNode) {
  const selection = editor?.state?.selection;
  if (
    !selection ||
    !currentListNode ||
    !["listItem", "taskItem"].includes(currentListNode.node.type.name)
  ) {
    return null;
  }

  const blockChildren = [];
  currentListNode.node.forEach((child, offset, index) => {
    blockChildren.push({
      index,
      node: child,
      from: currentListNode.pos + 1 + offset,
      to: currentListNode.pos + 1 + offset + child.nodeSize,
    });
  });

  if (blockChildren.length <= 1) {
    return null;
  }

  const matchingChild = blockChildren
    .slice(1)
    .find(
      (child) => selection.from >= child.from && selection.from <= child.to,
    );
  return matchingChild ? matchingChild.index : null;
}

function getEditorJsonNodeAtPath(root, path) {
  if (!root || !Array.isArray(path)) {
    return null;
  }

  let current = root;
  for (const index of path) {
    if (
      !current ||
      !Array.isArray(current.content) ||
      !current.content[index]
    ) {
      return null;
    }
    current = current.content[index];
  }
  return current;
}

function getEditorJsonPathForDepth(selection, depth) {
  if (!selection || typeof depth !== "number" || depth <= 0) {
    return [];
  }
  return Array.from({ length: depth }, (_entry, index) =>
    selection.$from.index(index),
  );
}

function cloneEditorJsonNode(node, override = {}) {
  return {
    ...node,
    ...override,
  };
}

function decreaseListContinuationIndent(
  editor,
  currentListNode,
  continuationIndex,
) {
  if (
    !editor ||
    !currentListNode ||
    !["listItem", "taskItem"].includes(currentListNode.node.type.name) ||
    typeof continuationIndex !== "number" ||
    continuationIndex <= 0
  ) {
    return false;
  }

  const selection = editor.state.selection;
  const listDepth = currentListNode.depth - 1;
  if (listDepth <= 0) {
    return false;
  }

  const listPath = getEditorJsonPathForDepth(selection, listDepth);
  const itemPath = getEditorJsonPathForDepth(selection, currentListNode.depth);
  const containerPath = listPath.slice(0, -1);
  const listIndex = listPath[listPath.length - 1];
  const itemIndex = itemPath[itemPath.length - 1];
  const nextDoc = structuredClone(editor.getJSON());
  const containerNode = containerPath.length
    ? getEditorJsonNodeAtPath(nextDoc, containerPath)
    : nextDoc;
  if (
    !containerNode ||
    !Array.isArray(containerNode.content) ||
    typeof listIndex !== "number"
  ) {
    return false;
  }

  const listNode = containerNode.content[listIndex];
  if (
    !listNode ||
    !Array.isArray(listNode.content) ||
    typeof itemIndex !== "number"
  ) {
    return false;
  }

  const targetItem = listNode.content[itemIndex];
  if (
    !targetItem ||
    !Array.isArray(targetItem.content) ||
    continuationIndex >= targetItem.content.length
  ) {
    return false;
  }

  const hoistedBlocks = targetItem.content.slice(continuationIndex);
  if (!hoistedBlocks.length) {
    return false;
  }

  const prefixItems = listNode.content.slice(0, itemIndex + 1);
  const suffixItems = listNode.content.slice(itemIndex + 1);
  prefixItems[prefixItems.length - 1] = cloneEditorJsonNode(targetItem, {
    content: targetItem.content.slice(0, continuationIndex),
  });
  const replacementBlocks = [];
  if (prefixItems.length) {
    replacementBlocks.push(
      cloneEditorJsonNode(listNode, { content: prefixItems }),
    );
  }
  replacementBlocks.push(...hoistedBlocks);
  if (suffixItems.length) {
    replacementBlocks.push(
      cloneEditorJsonNode(listNode, { content: suffixItems }),
    );
  }
  containerNode.content.splice(listIndex, 1, ...replacementBlocks);

  editor.commands.setContent(addIndentAttributesToJsonNode(nextDoc), false);
  return true;
}

function indentVisualSelection(editor, direction: "in" | "out") {
  const listKinds = getVisualIndentKinds(editor);
  if (listKinds.has("listItem")) {
    if (direction === "in") {
      return editor.chain().focus().sinkListItem("listItem").run();
    }
    const currentListNode = findParentNode(editor.state.selection, [
      "listItem",
    ]);
    const continuationIndex = getSelectionListContinuationIndex(
      editor,
      currentListNode,
    );
    if (
      decreaseListContinuationIndent(editor, currentListNode, continuationIndex)
    ) {
      return true;
    }
    return editor.chain().focus().liftListItem("listItem").run();
  }
  if (listKinds.has("taskItem")) {
    if (direction === "in") {
      return editor.chain().focus().sinkListItem("taskItem").run();
    }
    const currentListNode = findParentNode(editor.state.selection, [
      "taskItem",
    ]);
    const continuationIndex = getSelectionListContinuationIndex(
      editor,
      currentListNode,
    );
    if (
      decreaseListContinuationIndent(editor, currentListNode, continuationIndex)
    ) {
      return true;
    }
    return editor.chain().focus().liftListItem("taskItem").run();
  }
  if (direction === "in" && canNestSelectedBlocksUnderPreviousList(editor)) {
    return nestSelectedBlocksUnderPreviousList(editor);
  }
  return false;
}

export function runVisualIndent(editor, direction: "in" | "out") {
  if (!editor) {
    return false;
  }

  let handled = false;
  preserveSurfaceScroll(getEditorSurfaceElement(editor), () => {
    handled = indentVisualSelection(editor, direction);
  });
  return handled;
}

function getVisualIndentKinds(editor) {
  const selection = editor?.state?.selection;
  if (!selection) {
    return new Set();
  }

  const kinds = new Set<string>();
  editor.state.doc.nodesBetween(selection.from, selection.to, (node) => {
    if (node.type.name === "listItem" || node.type.name === "taskItem") {
      kinds.add(node.type.name);
    }
  });

  if (!kinds.size) {
    const currentListNode = findParentNode(selection, ["listItem", "taskItem"]);
    if (currentListNode) {
      kinds.add(currentListNode.node.type.name);
    }
  }

  return kinds;
}

export function isVisualIndentAvailable(editor, direction: "in" | "out") {
  if (getVisualIndentKinds(editor).size > 0) {
    return true;
  }
  if (direction === "in" && canNestSelectedBlocksUnderPreviousList(editor)) {
    return true;
  }
  return false;
}

export function shouldPreserveSelectionOnContextMenu(editor, pos) {
  const selection = editor?.state?.selection;
  if (!selection || selection.empty || typeof pos !== "number") {
    return false;
  }
  if (pos < selection.from || pos > selection.to) {
    return false;
  }
  return editor.state.doc
    .textBetween(selection.from, selection.to, "\n", "\n")
    .includes("\n");
}

export function getEditorModalSize(type) {
  switch (type) {
    case "fullscreen-editor":
      return "fullscreenEditor";
    case "html":
      return "wide";
    case "math-block":
      return "md";
    case "anchor":
    case "inline-math":
    case "link":
    case "link-current-article":
    case "image":
    case "video":
    default:
      return "sm";
  }
}

function insertLinkAtSelection({ editor, state, href }) {
  const selected = editor.state.doc.textBetween(
    editor.state.selection.from,
    editor.state.selection.to,
    " ",
  );
  if (!selected) {
    const text = state.label || state.url;
    if (!text) {
      return false;
    }
    return runEditorCommandFollowingCaret(editor, () =>
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text,
          marks: [{ type: "link", attrs: { href } }],
        })
        .run(),
    );
  }
  return editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
}

export function addIndentAttributesToJsonNode(node) {
  if (!node || typeof node !== "object") {
    return node;
  }

  const children = Array.isArray(node.content)
    ? node.content.map(addIndentAttributesToJsonNode)
    : node.content;
  const blockNames = new Set([
    "paragraph",
    "heading",
    "blockquote",
    "codeBlock",
    "mathBlock",
    "anchorBlock",
    "admonitionBlock",
    "tabsBlock",
    "imageBlock",
    "videoBlock",
    "table",
  ]);
  if (!blockNames.has(node.type)) {
    return children === node.content ? node : { ...node, content: children };
  }

  return {
    ...node,
    attrs: {
      ...(node.attrs || {}),
      indent: typeof node.attrs?.indent === "number" ? node.attrs.indent : 0,
    },
    content: children,
  };
}

export function insertMarkdownTable(
  insertMarkdown,
  rows,
  columns,
  labels = {},
) {
  const safeRows = Math.max(2, Math.min(10, rows));
  const safeColumns = Math.max(2, Math.min(10, columns));
  const header = `| ${new Array(safeColumns).fill(labels.header || "Header").join(" | ")} |`;
  const divider = `| ${new Array(safeColumns).fill("---").join(" | ")} |`;
  const body = new Array(Math.max(safeRows - 1, 0))
    .fill(0)
    .map(
      () =>
        `| ${new Array(safeColumns).fill(labels.cell || "Cell").join(" | ")} |`,
    )
    .join("\n");
  insertMarkdown([header, divider, body].filter(Boolean).join("\n"));
}

export function parseDelimitedTable(value: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = String(value || "").replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((item) => item !== "")) {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell);
  if (row.some((item) => item !== "")) {
    rows.push(row);
  }
  const columns = Math.max(0, ...rows.map((item) => item.length));
  return rows.map((item) => [
    ...item,
    ...new Array(columns - item.length).fill(""),
  ]);
}

export function tableRowsToMarkdown(rows: string[][]) {
  if (rows.length < 1 || rows[0].length < 1) {
    return "";
  }
  const escapeCell = (value: string) =>
    String(value).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
  return [
    `| ${rows[0].map(escapeCell).join(" | ")} |`,
    `| ${rows[0].map(() => "---").join(" | ")} |`,
    ...rows.slice(1).map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
  ].join("\n");
}

export function spreadsheetSheetToTableRows(sheet, utils) {
  const range = sheet?.["!ref"];
  if (!range) {
    return [];
  }
  const { decode_range, encode_cell, format_cell } = utils;
  const { s, e } = decode_range(range);
  const rows: string[][] = [];

  for (let rowIndex = s.r; rowIndex <= e.r; rowIndex += 1) {
    const row: string[] = [];
    for (let columnIndex = s.c; columnIndex <= e.c; columnIndex += 1) {
      const address = encode_cell({ r: rowIndex, c: columnIndex });
      const cell = sheet[address];
      row.push(cell ? format_cell(cell) : "");
    }
    if (row.some((value) => value !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

export function createModalSubmitter({
  modalState,
  getState,
  editor,
  markdownMode,
  insertMarkdown,
  replaceMarkdownSelection,
  updateCustomNode,
  closeModal,
}) {
  function buildHtmlDirective(value) {
    const lines = String(value || "")
      .replace(/\r\n?/g, "\n")
      .split("\n");
    return ["::html", ...lines.map((line) => `:: ${line}`)].join("\n");
  }

  return function submit() {
    const payload = modalState?.payload || {};
    const state = getState();
    if (!editor && !markdownMode) {
      closeModal();
      return;
    }

    switch (modalState?.type) {
      case "link": {
        if (markdownMode) {
          replaceMarkdownSelection((selected) => ({
            text: `[${state.label || selected || state.url}](${state.url})`,
          }));
        } else {
          if (
            insertLinkAtSelection({ editor, state, href: state.url }) === false
          ) {
            return;
          }
        }
        break;
      }
      case "link-current-article": {
        const headingOptions = Array.isArray(payload.headingOptions)
          ? payload.headingOptions
          : [];
        const formulaOptions = Array.isArray(payload.formulaOptions)
          ? payload.formulaOptions
          : [];
        const anchorOptions = Array.isArray(payload.anchorOptions)
          ? payload.anchorOptions
          : [];
        const selectedHeading =
          headingOptions.find((heading) => heading.id === state.targetId) ||
          headingOptions[0];
        const selectedFormula =
          formulaOptions.find((formula) => formula.id === state.targetId) ||
          formulaOptions[0];
        const selectedAnchor =
          anchorOptions.find((anchor) => anchor.id === state.targetId) ||
          anchorOptions[0];
        const selectedTarget =
          state.linkType === "formula"
            ? selectedFormula
            : state.linkType === "anchor"
              ? selectedAnchor
              : selectedHeading;
        const href = selectedTarget?.id ? `#${selectedTarget.id}` : "";
        const label = state.label || selectedTarget?.text || href;
        if (!href) {
          return;
        }
        if (markdownMode) {
          replaceMarkdownSelection((selected) => ({
            text: `[${label || selected || href}](${href})`,
          }));
        } else {
          if (
            insertLinkAtSelection({
              editor,
              state: { ...state, label, url: href },
              href,
            }) === false
          ) {
            return;
          }
        }
        break;
      }
      case "anchor": {
        const anchorId =
          buildHeadingSlug(String(state.anchorName || "")) || "anchor";
        if (!anchorId) {
          return;
        }
        if (markdownMode) {
          insertMarkdown(`::anchor{id="${anchorId}"}`);
        } else {
          updateCustomNode(payload.pos, "anchorBlock", { id: anchorId });
        }
        break;
      }
      case "image": {
        if (markdownMode) {
          insertMarkdown(`![${state.label}](${state.url})`);
        } else {
          updateCustomNode(payload.pos, "imageBlock", {
            src: state.url,
            alt: state.label,
          });
        }
        break;
      }
      case "video": {
        if (markdownMode) {
          insertMarkdown(
            `::video{src="${state.url}" title="${state.label || state.url}"}`,
          );
        } else {
          updateCustomNode(payload.pos, "videoBlock", {
            src: state.url,
            caption: state.label,
            title: state.label,
            poster: "",
          });
        }
        break;
      }
      case "html": {
        if (markdownMode) {
          insertMarkdown(buildHtmlDirective(state.html));
        } else {
          updateCustomNode(payload.pos, "customBlock", {
            kind: "html",
            data: { html: state.html },
            indent: 0,
          });
        }
        break;
      }
      case "inline-math": {
        if (markdownMode) {
          insertMarkdown(`\\(${state.formula}\\)`);
        } else if (typeof payload.pos === "number") {
          editor
            .chain()
            .focus()
            .setNodeSelection(payload.pos)
            .updateAttributes("inlineMath", { value: state.formula })
            .run();
        } else {
          runEditorCommandFollowingCaret(editor, () =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: "inlineMath",
                attrs: { value: state.formula },
              })
              .run(),
          );
        }
        break;
      }
      case "math-block": {
        if (markdownMode) {
          insertMarkdown(`$$\n${state.formula}\n$$`);
        } else {
          updateCustomNode(payload.pos, "mathBlock", { value: state.formula });
        }
        break;
      }
      default:
        break;
    }

    closeModal();
  };
}
