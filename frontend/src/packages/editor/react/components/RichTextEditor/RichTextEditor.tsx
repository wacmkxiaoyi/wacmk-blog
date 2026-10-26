import React from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import * as XLSX from "xlsx";
import "katex/dist/katex.min.css";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-python";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import { Modal } from "../../../../modal/index.ts";
import { useContextActionsMenu } from "../../../../context-actions/index.ts";
import { EditorModalContent } from "./EditorModalContent.tsx";
import { EditorInlineToolPanel } from "../EditorInlineToolPanel/index.ts";
import { EditorToolbar } from "../EditorToolbar/index.ts";
import {
  type ContentDocument,
  useContentNavigation,
} from "../../../../content-renderer/index.ts";
import { translateLabel } from "../../../core/i18n.ts";
import {
  contentDocumentToEditorDoc,
  editorDocToContentDocument,
  editorDocToMarkdown,
  markdownToEditorDoc,
} from "../../../core/bridges.ts";
import {
  indexCustomBlockTools,
  indexEditorTools,
  sortEditorTools,
} from "../../../core/toolRegistry.ts";
import type {
  EditorCustomBlockContextMenuGroup,
  EditorToolContext,
  EditorToolDefinition,
  RichTextEditorProps,
} from "../../../core/types.ts";
import { AddIcon, DeleteIcon } from "../../icons/index.ts";
import { buildDefaultEditorTools } from "../../tools/index.ts";
import {
  createRichTextEditorExtensions,
  makeBridgeRef,
  normalizeEditorHeadingIds,
} from "./extensions/index.ts";
import {
  buildToolContextMenuGroups,
  resolveToolContextNode,
  syncSelectionToContextTarget,
} from "./helpers/contextMenuHelpers.ts";
import {
  addIndentAttributesToJsonNode,
  buildEditorShellClassName,
  clampEditorHeight,
  createInlinePalettePosition,
  createModalSubmitter,
  deleteCurrentBlock,
  deleteNodeAtPos,
  getContextLinkData,
  getEditorModalSize,
  getSelectedMarkdown,
  indentMarkdownLines,
  insertParagraphBelow,
  insertMarkdownTable,
  isVisualIndentAvailable,
  normalizeTabsBlockNodeAttrs,
  parseDelimitedTable,
  placeCaretWhenClickingBelowEditorContent,
  replaceTextareaSelection,
  resolveContextNode,
  runEditorCommandFollowingCaret,
  runEditorCommandWithoutScroll,
  runVisualIndent,
  setNodeAttrsAtPos,
  shouldPreserveSelectionOnContextMenu,
  tableRowsToMarkdown,
  spreadsheetSheetToTableRows,
  useLatest,
} from "./helpers/richTextEditorRuntime.ts";
import type {
  EditorModalFormState,
  RichTextEditorModalState,
} from "./helpers/types.ts";
import { executeEditorTool } from "./helpers/toolExecutionHelpers.ts";
import { highlightExtendedMarkdown } from "./helpers/markdownHighlighting.ts";
import styles from "./RichTextEditor.module.css";

export { buildDefaultEditorTools } from "../../tools/index.ts";

export function RichTextEditor({
  value = "",
  onChange,
  translate,
  className,
  placeholder,
  tools,
  allowFullscreenTool = true,
  resizable = true,
  fillHeight = false,
  minHeight = 280,
  maxHeight = 840,
  initialHeight,
  resolveAssetUrl,
  assetPreviewVersion = 0,
  customBlockVersion = 0,
}: RichTextEditorProps) {
  const t = React.useCallback(
    (key: string, fallback: string) => translateLabel(translate, key, fallback),
    [translate],
  );
  const bridgeRef = React.useRef(makeBridgeRef());
  const assetPreviewListenersRef = React.useRef(new Set<() => void>());
  const assetPreviewVersionRef = React.useRef(assetPreviewVersion);
  const customBlockListenersRef = React.useRef(new Set<() => void>());
  const customBlockVersionRef = React.useRef(customBlockVersion);
  const getAssetPreviewVersion = React.useCallback(
    () => assetPreviewVersionRef.current,
    [],
  );
  const subscribeAssetPreview = React.useCallback((listener: () => void) => {
    assetPreviewListenersRef.current.add(listener);
    return () => assetPreviewListenersRef.current.delete(listener);
  }, []);
  const getCustomBlockVersion = React.useCallback(
    () => customBlockVersionRef.current,
    [],
  );
  const subscribeCustomBlock = React.useCallback((listener: () => void) => {
    customBlockListenersRef.current.add(listener);
    return () => customBlockListenersRef.current.delete(listener);
  }, []);
  const markdownTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const markdownHighlightRef = React.useRef<HTMLElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const surfaceShellRef = React.useRef<HTMLDivElement | null>(null);
  const inlinePanelAnchorRef = React.useRef<HTMLElement | null>(null);
  const inlinePanelRef = React.useRef<HTMLDivElement | null>(null);
  const navigationViewportRef = React.useRef<HTMLDivElement | null>(null);
  const delimitedTableInputRef = React.useRef<HTMLInputElement | null>(null);
  const spreadsheetTableInputRef = React.useRef<HTMLInputElement | null>(null);
  const [modalState, setModalState] =
    React.useState<RichTextEditorModalState | null>(null);
  const [markdownMode, setMarkdownMode] = React.useState(false);
  const [navigationOpen, setNavigationOpen] = React.useState(false);
  const [navigationViewport, setNavigationViewport] =
    React.useState<HTMLDivElement | null>(null);
  const [markdownValue, setMarkdownValue] = React.useState(value || "");
  const [panelHeight, setPanelHeight] = React.useState(() =>
    clampEditorHeight(initialHeight ?? minHeight, minHeight, maxHeight),
  );
  const [inlinePanel, setInlinePanel] = React.useState<null | {
    type: "color" | "table";
    position: { top: number; left: number };
  }>(null);
  const documentRef = React.useRef<ContentDocument>({
    type: "document",
    version: 1,
    format: "rich-text",
    children: [],
  });
  const customBlockRegistryRef = React.useRef<
    Record<string, EditorToolDefinition>
  >({});
  const markdownRef = useLatest(markdownValue);
  const labelsRef = useLatest({
    copy: t("editor.action.copy", "Copy"),
    copied: t("editor.action.copied", "Copied"),
    expand: t("editor.action.expand", "Expand"),
    collapse: t("editor.action.collapse", "Collapse"),
    permalink: t("editor.action.permalink", "Permalink"),
  });
  const { menu, toggleRightClick, openAt } = useContextActionsMenu({
    zIndex: 2600,
  });
  const [navigationDocument, setNavigationDocument] =
    React.useState<ContentDocument>(documentRef.current);
  const navigation = useContentNavigation({
    document: navigationDocument,
    minLevel: 1,
    maxLevel: 3,
    tree: false,
    root: navigationViewport,
    offsetTop: 16,
    observeActive:
      navigationOpen && !markdownMode && Boolean(navigationViewport),
    rootMargin: "0px 0px -65% 0px",
    threshold: 0.1,
  });
  const highlightedMarkdownHtml = React.useMemo(
    () => highlightExtendedMarkdown(markdownValue),
    [markdownValue],
  );

  const editorExtensions = React.useMemo(
    () =>
      createRichTextEditorExtensions({
        labelsRef,
        bridgeRef,
        customBlockRegistryRef,
      }),
    [labelsRef],
  );

  bridgeRef.current.openModal = (type, payload) =>
    setModalState({ type, payload });
  bridgeRef.current.openContextMenu = (point, groups) =>
    openAt(point, groups as any);
  bridgeRef.current.translate = t;
  bridgeRef.current.resolveAssetUrl = resolveAssetUrl || (() => undefined);
  bridgeRef.current.getAssetPreviewVersion = getAssetPreviewVersion;
  bridgeRef.current.subscribeAssetPreview = subscribeAssetPreview;
  bridgeRef.current.getCustomBlockVersion = getCustomBlockVersion;
  bridgeRef.current.subscribeCustomBlock = subscribeCustomBlock;

  React.useEffect(() => {
    assetPreviewVersionRef.current = assetPreviewVersion;
    assetPreviewListenersRef.current.forEach((listener) => listener());
  }, [assetPreviewVersion]);

  React.useEffect(() => {
    customBlockVersionRef.current = customBlockVersion;
    customBlockListenersRef.current.forEach((listener) => listener());
  }, [customBlockVersion]);

  const editor = useEditor({
    extensions: editorExtensions,
    content: addIndentAttributesToJsonNode(
      normalizeEditorHeadingIds(
        contentDocumentToEditorDoc(
          editorDocToContentDocument(markdownToEditorDoc(value || "")),
        ),
      ),
    ),
    autofocus: false,
    editable: true,
    editorProps: {
      attributes: {
        class: buildEditorShellClassName(),
      },
      handleKeyDown(_view, event) {
        if (!editor || event.key !== "Tab") {
          return false;
        }
        if (editor.isActive("codeBlock")) {
          return false;
        }
        const handled = runVisualIndent(editor, event.shiftKey ? "out" : "in");
        if (handled) {
          event.preventDefault();
        }
        return handled;
      },
    },
    onUpdate({ editor: currentEditor }) {
      const nextMarkdown = editorDocToMarkdown(currentEditor.getJSON());
      setMarkdownValue(nextMarkdown);
      const nextDocument = editorDocToContentDocument(currentEditor.getJSON());
      documentRef.current = nextDocument;
      setNavigationDocument(nextDocument);
      onChange?.(nextMarkdown, nextDocument);
    },
  });

  React.useEffect(() => {
    if (!editor) {
      return;
    }
    if (value === markdownRef.current) {
      return;
    }
    setMarkdownValue(value || "");
    if (markdownMode) {
      return;
    }
    editor.commands.setContent(
      addIndentAttributesToJsonNode(
        normalizeEditorHeadingIds(
          contentDocumentToEditorDoc(
            editorDocToContentDocument(markdownToEditorDoc(value || "")),
          ),
        ),
      ),
      false,
    );
  }, [editor, markdownMode, value]);

  React.useEffect(() => {
    setNavigationDocument(documentRef.current);
  }, [markdownValue]);

  React.useEffect(() => {
    if (!editor) {
      return;
    }
    const nextDocument = editorDocToContentDocument(editor.getJSON());
    documentRef.current = nextDocument;
    setNavigationDocument(nextDocument);
  }, [editor]);

  React.useEffect(() => {
    setPanelHeight((current) =>
      clampEditorHeight(current, minHeight, maxHeight),
    );
  }, [minHeight, maxHeight]);

  React.useEffect(() => {
    const node = surfaceShellRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const nextHeight = clampEditorHeight(
        Math.round(entry.contentRect.height),
        minHeight,
        maxHeight,
      );
      setPanelHeight((current) =>
        current === nextHeight ? current : nextHeight,
      );
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [minHeight, maxHeight]);

  React.useEffect(() => {
    if (!inlinePanel) {
      return undefined;
    }
    function handlePointerDown(event) {
      const target = event.target instanceof Node ? event.target : null;
      if (target && rootRef.current?.contains(target)) {
        return;
      }
      setInlinePanel(null);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [inlinePanel]);

  React.useLayoutEffect(() => {
    if (!inlinePanel) {
      return undefined;
    }

    function updateInlinePanelPosition() {
      const position = createInlinePalettePosition(
        inlinePanelAnchorRef.current,
        inlinePanelAnchorRef.current?.getBoundingClientRect?.(),
        inlinePanelRef.current?.getBoundingClientRect?.(),
        rootRef.current?.getBoundingClientRect?.(),
      );
      if (!position) {
        return;
      }
      setInlinePanel((current) =>
        current &&
        (current.position.top !== position.top ||
          current.position.left !== position.left)
          ? { ...current, position }
          : current,
      );
    }

    updateInlinePanelPosition();
    window.addEventListener("resize", updateInlinePanelPosition);
    window.addEventListener("scroll", updateInlinePanelPosition, true);
    return () => {
      window.removeEventListener("resize", updateInlinePanelPosition);
      window.removeEventListener("scroll", updateInlinePanelPosition, true);
    };
  }, [inlinePanel?.type]);

  React.useEffect(() => {
    const textarea = markdownTextareaRef.current;
    if (!textarea) {
      return;
    }
    syncMarkdownHighlightScroll(textarea);
  }, [highlightedMarkdownHtml, markdownMode]);

  const toolList = React.useMemo(() => {
    const baseTools = tools?.length
      ? tools
      : buildDefaultEditorTools(t, {
          openInlinePanel,
          getContextLinkData,
        });
    return sortEditorTools(
      baseTools.filter(
        (tool) => allowFullscreenTool || tool.key !== "fullscreen-editor",
      ),
    );
  }, [allowFullscreenTool, t, tools]);
  customBlockRegistryRef.current = indexCustomBlockTools(toolList);
  const toolIndex = React.useMemo(() => indexEditorTools(toolList), [toolList]);
  const groupedTools = React.useMemo(() => {
    const childKeys = new Set(toolList.flatMap((tool) => tool.subTools || []));
    return toolList.reduce<Record<number, EditorToolDefinition[]>>(
      (result, tool) => {
        result[tool.group] = result[tool.group] || [];
        if (!childKeys.has(tool.key)) {
          result[tool.group].push(tool);
        }
        return result;
      },
      {},
    );
  }, [toolList]);
  function syncMarkdownState(
    nextMarkdown: string,
    nextDocument?: ContentDocument,
    options?: { syncVisualEditor?: boolean },
  ) {
    setMarkdownValue(nextMarkdown);
    const contentDocument =
      nextDocument ||
      editorDocToContentDocument(markdownToEditorDoc(nextMarkdown));
    documentRef.current = contentDocument;
    setNavigationDocument(contentDocument);
    if (options?.syncVisualEditor && editor && !markdownMode) {
      editor.commands.setContent(
        addIndentAttributesToJsonNode(
          normalizeEditorHeadingIds(
            contentDocumentToEditorDoc(contentDocument),
          ),
        ),
        false,
      );
    }
    onChange?.(nextMarkdown, contentDocument);
  }

  function syncMarkdownToCallback(nextMarkdown: string) {
    syncMarkdownState(nextMarkdown);
  }

  function runVisualCommand(command: () => boolean | void) {
    if (!editor) {
      return;
    }
    runEditorCommandWithoutScroll(editor, () => {
      const result = command();
      editor.commands.focus(undefined, { scrollIntoView: false });
      return result;
    });
  }

  function runVisualInsertCommand(command: () => boolean | void) {
    if (!editor) {
      return;
    }
    runEditorCommandFollowingCaret(editor, command);
  }

  function insertMarkdown(
    valueToInsert: string,
    options?: { selectOffset?: number; selectLength?: number },
  ) {
    if (markdownMode) {
      const textarea = markdownTextareaRef.current;
      if (!textarea) {
        return;
      }
      replaceTextareaSelection(
        textarea,
        valueToInsert,
        options?.selectOffset || valueToInsert.length,
        options?.selectLength || 0,
      );
      return;
    }
    if (!editor) {
      return;
    }
    const fragment = markdownToEditorDoc(valueToInsert);
    runVisualInsertCommand(() =>
      editor
        .chain()
        .focus()
        .insertContent(fragment.content || [])
        .run(),
    );
  }

  function replaceAssetId(temporaryAssetId: string, assetId: string) {
    const currentMarkdown = markdownMode
      ? markdownRef.current
      : editor
        ? editorDocToMarkdown(editor.getJSON())
        : markdownRef.current;
    syncMarkdownState(
      currentMarkdown.replaceAll(
        `assetId="${temporaryAssetId}"`,
        `assetId="${assetId}"`,
      ),
      undefined,
      { syncVisualEditor: true },
    );
  }

  function replaceMarkdownSelection(updater) {
    const textarea = markdownTextareaRef.current;
    if (!textarea) {
      return;
    }
    const selected = getSelectedMarkdown(textarea);
    const next = updater(selected);
    replaceTextareaSelection(
      textarea,
      next.text,
      next.selectOffset ?? 0,
      next.selectLength ?? 0,
    );
  }

  function syncMarkdownHighlightScroll(textarea: HTMLTextAreaElement) {
    const highlight = markdownHighlightRef.current;
    if (!highlight) {
      return;
    }
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
  }

  function openInlinePanel(type) {
    const anchor = inlinePanelAnchorRef.current;
    const position = createInlinePalettePosition(
      anchor,
      anchor?.getBoundingClientRect?.(),
      inlinePanelRef.current?.getBoundingClientRect?.(),
      rootRef.current?.getBoundingClientRect?.(),
    );
    if (!position) {
      return;
    }
    setInlinePanel({ type, position });
  }

  function closeInlinePanel() {
    setInlinePanel(null);
  }

  function applyColor(token) {
    if (markdownMode) {
      replaceMarkdownSelection((selected) => ({
        text: `[${selected || t("editor.template.colorText", "Text")}]{.md-color-${token}}`,
      }));
    } else if (editor) {
      runVisualCommand(() => editor.chain().focus().setColorToken(token).run());
    }
    closeInlinePanel();
  }

  function applyTableSize(rows, columns) {
    if (markdownMode) {
      insertMarkdownTable(insertMarkdown, rows, columns, {
        header: t("editor.template.tableHeader", "Header"),
        cell: t("editor.template.tableCell", "Cell"),
      });
    } else if (editor) {
      runVisualInsertCommand(() =>
        editor
          .chain()
          .focus()
          .insertTable({ rows, cols: columns, withHeaderRow: true })
          .run(),
      );
    }
    closeInlinePanel();
  }

  async function importDelimitedTable(file: File) {
    const delimiter = file.name.toLowerCase().endsWith(".tsv") ? "\t" : ",";
    const rows = parseDelimitedTable(await file.text(), delimiter);
    insertImportedTable(rows);
  }

  function insertImportedTable(rows: string[][]) {
    const markdown = tableRowsToMarkdown(rows);
    if (!markdown) {
      return;
    }
    if (markdownMode) {
      insertMarkdown(markdown);
    } else if (editor) {
      const createCell = (type, value) => ({
        type,
        content: value
          ? [{ type: "paragraph", content: [{ type: "text", text: value }] }]
          : [{ type: "paragraph" }],
      });
      runVisualInsertCommand(() =>
        editor
          .chain()
          .focus()
          .insertContent({
            type: "table",
            content: rows.map((row, rowIndex) => ({
              type: "tableRow",
              content: row.map((value) =>
                createCell(rowIndex === 0 ? "tableHeader" : "tableCell", value),
              ),
            })),
          })
          .run(),
      );
    }
    closeInlinePanel();
  }

  async function importSpreadsheetTable(file: File) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    insertImportedTable(spreadsheetSheetToTableRows(sheet, XLSX.utils));
  }

  function openDelimitedTableFilePicker() {
    delimitedTableInputRef.current?.click();
  }

  function openSpreadsheetTableFilePicker() {
    spreadsheetTableInputRef.current?.click();
  }

  const toolContext = React.useMemo<EditorToolContext>(
    () => ({
      mode: markdownMode ? "markdown" : "visual",
      editor,
      markdownMode,
      navigationOpen,
      translate: t,
      openModal: (type, payload) => setModalState({ type, payload }),
      openInlinePanel,
      openDelimitedTableFilePicker,
      openSpreadsheetTableFilePicker,
      closeInlinePanel,
      runVisualCommand,
      runVisualInsertCommand,
      insertMarkdown,
      replaceAssetId,
      replaceMarkdownSelection,
      setMarkdownMode,
      setNavigationOpen,
      getDocument: () => documentRef.current,
    }),
    [editor, markdownMode, navigationOpen, t],
  );

  function handleNavigateToHeading(id: string) {
    navigation.navigate(id, {
      root: navigationViewportRef.current || undefined,
      offsetTop: 16,
      behavior: "smooth",
    });
  }

  function handleNavigationViewportRef(node: HTMLDivElement | null) {
    navigationViewportRef.current = node;
    setNavigationViewport(node);
  }

  function handleVisualEditorMouseDown(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    placeCaretWhenClickingBelowEditorContent(editor?.view, event);
  }

  function renderNavigationPanel() {
    return (
      <div className={styles.navigationLayout}>
        <div className={styles.navigationSidebar}>
          {navigation.flatItems.length ? (
            <ol className={styles.navigationList}>
              {navigation.flatItems.map((item) => (
                <li key={item.id} className={styles.navigationListItem}>
                  <button
                    type="button"
                    className={[
                      styles.navigationButton,
                      styles[`navigationButtonLevel${Math.min(item.level, 3)}`],
                      navigation.activeId === item.id
                        ? styles.navigationButtonActive
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => handleNavigateToHeading(item.id)}
                    title={item.text}
                  >
                    {item.text}
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <div className={styles.navigationEmpty}>
              {t(
                "editor.navigation.empty",
                "Add h1, h2, or h3 to build navigation.",
              )}
            </div>
          )}
        </div>

        <div className={styles.navigationDivider} aria-hidden="true" />

        <div
          ref={handleNavigationViewportRef}
          className={styles.navigationContentViewport}
          onMouseDownCapture={handleVisualEditorMouseDown}
        >
          <div className={styles.visualEditor}>
            <EditorContent
              editor={editor}
              placeholder={
                placeholder || t("editor.placeholder", "Write something...")
              }
            />
          </div>
        </div>
      </div>
    );
  }

  function toggleEditorMarkdownMode() {
    if (!markdownMode && editor) {
      const nextMarkdown = editorDocToMarkdown(editor.getJSON());
      setMarkdownValue(nextMarkdown);
    }
    setMarkdownMode((current) => {
      const next = !current;
      if (next) {
        setNavigationOpen(false);
      }
      if (current && editor) {
        editor.commands.setContent(
          addIndentAttributesToJsonNode(
            normalizeEditorHeadingIds(
              contentDocumentToEditorDoc(
                editorDocToContentDocument(
                  markdownToEditorDoc(markdownRef.current),
                ),
              ),
            ),
          ),
          false,
        );
      }
      return next;
    });
  }

  function executeTool(tool: EditorToolDefinition, event?) {
    inlinePanelAnchorRef.current =
      event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    executeEditorTool({
      tool,
      editor,
      markdownMode,
      toolContext,
      event,
      insertMarkdown: (value) => insertMarkdown(value),
      toggleMarkdownMode: toggleEditorMarkdownMode,
      helpers: { openInlinePanel },
    });
  }

  function handleContextMenu(event) {
    if (!editor || markdownMode) {
      return;
    }
    const target = event.target instanceof HTMLElement ? event.target : null;
    const clickedPos = editor.view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    })?.pos;
    if (shouldPreserveSelectionOnContextMenu(editor, clickedPos)) {
      const tabsTarget =
        target?.closest?.("[data-editor-node-type='tabsBlock']") || null;
      const tabsNode = tabsTarget
        ? resolveContextNode(
            editor,
            event.target,
            tabsTarget,
            ["tabsBlock"],
            editor.state.selection,
          )
        : null;
      if (tabsNode?.node) {
        normalizeTabsBlockNodeAttrs(editor, tabsNode.pos);
      }
    }
    const toolContextNodes = toolList
      .map((tool) => ({
        tool,
        contextNode: resolveToolContextNode(
          editor,
          event.target,
          editor.state.selection,
          tool,
          {
            getContextLinkData,
            resolveContextNode,
          },
        ),
      }))
      .filter((entry) => entry.contextNode);
    if (
      !shouldPreserveSelectionOnContextMenu(editor, clickedPos) ||
      !toolContextNodes.length
    ) {
      syncSelectionToContextTarget(
        editor,
        event,
        shouldPreserveSelectionOnContextMenu,
      );
    }
    const selection = editor.state.selection;
    const canIncreaseIndent = isVisualIndentAvailable(editor, "in");
    const canDecreaseIndent = isVisualIndentAvailable(editor, "out");
    const groups = [
      {
        group: 0,
        children: [
          {
            key: "indent-in",
            label: t("editor.context.increaseIndent", "Increase indent"),
            icon: <AddIcon />,
            disabled: !canIncreaseIndent,
            onClick: () => runVisualIndent(editor, "in"),
          },
          {
            key: "indent-out",
            label: t("editor.context.decreaseIndent", "Decrease indent"),
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
            label: t(
              "editor.context.addParagraphBelow",
              "Add a paragraph below",
            ),
            icon: <AddIcon />,
            onClick: () => insertParagraphBelow(editor),
          },
          {
            key: "delete-current-block",
            label: t("editor.context.delete", "Delete"),
            icon: <DeleteIcon />,
            danger: true,
            onClick: () => deleteCurrentBlock(editor),
          },
        ],
      },
    ];

    const handledToolKeys = new Set(
      toolContextNodes.map((entry) => entry.tool.key),
    );

    toolContextNodes.forEach(({ tool, contextNode }) => {
      groups.push(
        ...buildToolContextMenuGroups(tool, {
          toolContext,
          target,
          event,
          contextNode,
          updateNodeAttrs: (pos, attrs) =>
            setNodeAttrsAtPos(editor, pos, attrs),
          deleteNode: (pos) => deleteNodeAtPos(editor, pos),
        }),
      );
    });

    const customBlockElement =
      target?.closest?.("[data-editor-node-type='customBlock']") || null;
    const customNode = resolveContextNode(
      editor,
      event.target,
      customBlockElement,
      ["customBlock"],
      selection,
    );
    const customKind = String(customNode?.node?.attrs?.kind || "");
    const customTool = customBlockRegistryRef.current[customKind];
    if (
      customNode?.node &&
      customTool?.customBlock?.getContextMenuGroups &&
      !handledToolKeys.has(customTool.key)
    ) {
      const attrs = customNode.node.attrs || {};
      const customGroups = customTool.customBlock.getContextMenuGroups({
        kind: customKind,
        data: attrs.data && typeof attrs.data === "object" ? attrs.data : {},
        pos: customNode.pos,
        editor,
        translate: t,
        openModal: (type, payload) =>
          setModalState({ type, payload } as RichTextEditorModalState),
        updateData: (nextData) => {
          const currentData =
            attrs.data && typeof attrs.data === "object" ? attrs.data : {};
          const resolved =
            typeof nextData === "function" ? nextData(currentData) : nextData;
          setNodeAttrsAtPos(editor, customNode.pos, { data: resolved });
        },
        updateAttrs: (nextAttrs) =>
          setNodeAttrsAtPos(editor, customNode.pos, nextAttrs),
      }) as EditorCustomBlockContextMenuGroup[];
      groups.push(...customGroups);
    }

    if (
      !groups.some(
        (group) => Array.isArray(group.children) && group.children.length,
      )
    ) {
      return;
    }

    toggleRightClick(event, groups);
  }

  function closeModal() {
    setModalState(null);
  }

  function updateCustomNode(pos, name, attrs) {
    if (!editor) {
      return;
    }
    if (typeof pos === "number") {
      setNodeAttrsAtPos(editor, pos, attrs);
      return;
    }
    runVisualInsertCommand(() =>
      editor.chain().focus().insertContent({ type: name, attrs }).run(),
    );
  }

  function renderModalContent() {
    if (!modalState) {
      return null;
    }

    if (modalState.type === "fullscreen-editor") {
      return (
        <div className={styles.fullscreenEditorModal}>
          <RichTextEditor
            value={markdownValue}
            onChange={(nextMarkdown, nextDocument) => {
              syncMarkdownState(nextMarkdown, nextDocument, {
                syncVisualEditor: true,
              });
            }}
            translate={translate}
            className={styles.fullscreenEditorInstance}
            placeholder={placeholder}
            tools={tools}
            allowFullscreenTool={false}
            resizable={false}
            fillHeight
            minHeight={Math.max(minHeight, 520)}
            maxHeight={Math.max(maxHeight, 960)}
            initialHeight={Math.max(initialHeight ?? minHeight, 640)}
            resolveAssetUrl={resolveAssetUrl}
            assetPreviewVersion={assetPreviewVersion}
            customBlockVersion={customBlockVersion}
          />
        </div>
      );
    }

    if (
      [
        "link",
        "link-current-article",
        "anchor",
        "image",
        "video",
        "html",
        "inline-math",
        "math-block",
      ].includes(modalState.type)
    ) {
      return (
        <EditorModalContent
          modalState={modalState}
          translate={t}
          stateRef={modalFormStateRef}
        />
      );
    }

    return null;
  }

  const modalSubmitRef = React.useRef<null | (() => void)>(null);
  const modalFormStateRef = React.useRef<EditorModalFormState>({
    label: "",
    url: "",
    formula: "",
    html: "",
    anchorName: "",
    linkType: "section",
    targetId: "",
  });
  React.useEffect(() => {
    if (!modalState) {
      modalSubmitRef.current = null;
      modalFormStateRef.current = {
        label: "",
        url: "",
        formula: "",
        html: "",
        anchorName: "",
        linkType: "section",
        targetId: "",
      };
      return;
    }
    modalSubmitRef.current = createModalSubmitter({
      modalState,
      getState: () => modalFormStateRef.current,
      editor,
      markdownMode,
      insertMarkdown,
      replaceMarkdownSelection,
      updateCustomNode,
      closeModal,
    });
  }, [
    closeModal,
    editor,
    insertMarkdown,
    markdownMode,
    modalState,
    replaceMarkdownSelection,
  ]);
  const modalActions = React.useMemo(() => {
    if (!modalState) {
      return [];
    }
    return [
      {
        key: "cancel",
        variant: "secondary",
        onClick: ({ close }) => close(),
      },
      {
        key: "confirm",
        variant: "primary",
        onClick: () => modalSubmitRef.current?.(),
      },
    ];
  }, [modalState]);

  return (
    <div
      ref={rootRef}
      className={[
        styles.root,
        fillHeight ? styles.rootFillHeight : "",
        className || "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <EditorToolbar
        groupedTools={groupedTools}
        toolIndex={toolIndex}
        editor={editor}
        markdownMode={markdownMode}
        toolContext={toolContext}
        onExecuteTool={executeTool}
      />

      <div
        ref={surfaceShellRef}
        className={[
          styles.surfaceShell,
          fillHeight ? styles.surfaceShellFillHeight : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={
          fillHeight
            ? { minHeight: 0, height: "100%" }
            : { minHeight, maxHeight, height: panelHeight }
        }
      >
        <div
          ref={surfaceRef}
          className={[
            styles.surface,
            navigationOpen && !markdownMode ? styles.surfaceNavigationMode : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onContextMenu={handleContextMenu}
          onMouseDownCapture={
            !markdownMode && !navigationOpen
              ? handleVisualEditorMouseDown
              : undefined
          }
        >
          {markdownMode ? (
            <div className={styles.markdownEditorShell}>
              <pre
                ref={markdownHighlightRef}
                aria-hidden="true"
                className={styles.markdownHighlight}
              >
                <code
                  className={[
                    styles.markdownHighlightCode,
                    "language-markdown",
                  ].join(" ")}
                  dangerouslySetInnerHTML={{ __html: highlightedMarkdownHtml }}
                />
              </pre>
              <textarea
                ref={markdownTextareaRef}
                className={styles.markdownTextarea}
                value={markdownValue}
                placeholder={
                  placeholder || t("editor.placeholder", "Write something...")
                }
                spellCheck={false}
                onChange={(event) => syncMarkdownToCallback(event.target.value)}
                onScroll={(event) =>
                  syncMarkdownHighlightScroll(event.currentTarget)
                }
                onKeyDown={(event) => {
                  if (event.key !== "Tab") {
                    return;
                  }
                  event.preventDefault();
                  indentMarkdownLines(
                    event.currentTarget,
                    event.shiftKey ? "out" : "in",
                  );
                }}
              />
            </div>
          ) : navigationOpen ? (
            renderNavigationPanel()
          ) : (
            <div className={styles.visualEditor}>
              <EditorContent
                editor={editor}
                placeholder={
                  placeholder || t("editor.placeholder", "Write something...")
                }
              />
            </div>
          )}
        </div>
        {resizable ? (
          <button
            type="button"
            className={styles.resizeHandle}
            aria-label={t("editor.a11y.resize", "Resize editor")}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const startY = event.clientY;
              const startHeight = panelHeight;
              const previousUserSelect = document.body.style.userSelect;
              document.body.style.userSelect = "none";

              function handlePointerMove(moveEvent) {
                setPanelHeight(
                  clampEditorHeight(
                    startHeight + (moveEvent.clientY - startY),
                    minHeight,
                    maxHeight,
                  ),
                );
              }

              function handlePointerUp() {
                document.body.style.userSelect = previousUserSelect;
                window.removeEventListener("pointermove", handlePointerMove);
                window.removeEventListener("pointerup", handlePointerUp);
              }

              event.currentTarget.setPointerCapture?.(event.pointerId);
              window.addEventListener("pointermove", handlePointerMove);
              window.addEventListener("pointerup", handlePointerUp);
            }}
          />
        ) : null}
      </div>

      {menu}

      {inlinePanel ? (
        <EditorInlineToolPanel
          inlinePanel={inlinePanel}
          translate={translate}
          panelRef={inlinePanelRef}
          onApplyColor={applyColor}
          onApplyTableSize={applyTableSize}
        />
      ) : null}

      <input
        ref={delimitedTableInputRef}
        type="file"
        accept=".csv,.tsv,text/csv,text/tab-separated-values"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) {
            void importDelimitedTable(file);
          }
        }}
      />
      <input
        ref={spreadsheetTableInputRef}
        type="file"
        accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) {
            void importSpreadsheetTable(file);
          }
        }}
      />

      <Modal
        open={Boolean(modalState)}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
        title={
          modalState
            ? t(`editor.modal.${modalState.type}.title`, modalState.type)
            : ""
        }
        size={getEditorModalSize(modalState?.type)}
        labels={{
          cancel: t("editor.modal.cancel", "Cancel"),
          confirm: t("editor.modal.confirm", "Confirm"),
          close: t("editor.modal.close", "Close"),
        }}
        actions={modalState?.type === "fullscreen-editor" ? [] : modalActions}
      >
        {renderModalContent()}
      </Modal>
    </div>
  );
}
