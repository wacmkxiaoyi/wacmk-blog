import React from "react";
import { AdmonitionIcon as RendererAdmonitionIcon } from "../../../content-renderer/react/renderers/blocks/admonitionIcons.tsx";
import { extractHeadingMenuItems } from "../../../content-renderer/core/navigation/extractHeadingMenuItems.ts";
import { EDITOR_CODE_LANGUAGES } from "../../core/constants.ts";
import { translateLabel } from "../../core/i18n.ts";
import { createEditorTool } from "../../core/toolRegistry.ts";
import type {
  EditorTranslate,
  EditorToolDefinition,
} from "../../core/types.ts";
import {
  AddIcon,
  AdmonitionIcon,
  AnchorIcon,
  BoldIcon,
  BulletListIcon,
  CheckboxListIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CodeBlockIcon,
  ColorIcon,
  DeleteIcon,
  FullscreenIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  Heading5Icon,
  HtmlIcon,
  HorizontalRuleIcon,
  ImageIcon,
  InlineCodeIcon,
  InlineMathIcon,
  ItalicIcon,
  LinkIcon,
  MarkdownIcon,
  MathBlockIcon,
  NavigationIcon,
  OrderedListIcon,
  ParagraphIcon,
  QuoteIcon,
  StrikeIcon,
  TableIcon,
  TabsIcon,
  UnderlineIcon,
  VideoIcon,
} from "../icons/index.ts";
import {
  createDefaultAdmonitionBlockAttrs,
  createDefaultTabsBlockContent,
} from "../components/RichTextEditor/helpers/customBlockHelpers.ts";
import { extractEquationTargets } from "../components/RichTextEditor/helpers/equations.ts";
import {
  buildLegacyToolMap,
  type LegacyToolHelpers,
} from "../components/RichTextEditor/helpers/toolExecutionHelpers.ts";
import { buildHeadingSlug } from "../../core/bridges.ts";
import { getHtmlFrameContentHeight } from "../../../content-renderer/react/utils/htmlFrameHeight.ts";

function HtmlPreviewBlock({ html, title }: { html: string; title: string }) {
  const frameRef = React.useRef<HTMLIFrameElement | null>(null);

  React.useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    let resizeObserver: ResizeObserver | null = null;

    function updateHeight() {
      const doc = frame.contentDocument;
      if (!doc) {
        return;
      }
      const nextHeight = getHtmlFrameContentHeight(doc);
      frame.style.height = `${nextHeight}px`;
    }

    function attachObserver() {
      const doc = frame.contentDocument;
      if (!doc) {
        return;
      }
      updateHeight();
      if (typeof ResizeObserver === "function") {
        resizeObserver = new ResizeObserver(() => updateHeight());
        if (doc.documentElement) resizeObserver.observe(doc.documentElement);
        if (doc.body) resizeObserver.observe(doc.body);
      }
    }

    frame.addEventListener("load", attachObserver);
    attachObserver();
    return () => {
      frame.removeEventListener("load", attachObserver);
      resizeObserver?.disconnect();
    };
  }, [html]);

  return (
    <div className="cr-html-block">
      <iframe
        ref={frameRef}
        title={title}
        className="cr-html-block-frame"
        sandbox="allow-scripts allow-modals allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        srcDoc={html || "<!doctype html><html><body></body></html>"}
      />
    </div>
  );
}

export type DefaultEditorToolBuilderHelpers = LegacyToolHelpers & {
  getContextLinkData?: (
    editor: unknown,
    target: EventTarget | null,
  ) => Record<string, unknown> | null;
};

function buildLinkModalPayload(editor) {
  return {
    label: editor?.state?.selection?.empty
      ? ""
      : editor.state.doc.textBetween(
          editor.state.selection.from,
          editor.state.selection.to,
          " ",
        ),
  };
}

function extractAnchorTargets(document) {
  const items: Array<{ id: string; text: string }> = [];

  function visitBlocks(nodes) {
    for (const node of Array.isArray(nodes) ? nodes : []) {
      if (!node) {
        continue;
      }

      if (node.type === "anchor" && node.id) {
        items.push({ id: node.id, text: node.id });
      }

      if (Array.isArray(node.children)) {
        visitBlocks(node.children);
      }

      if (Array.isArray(node.items)) {
        for (const item of node.items) {
          visitBlocks(item?.children);
        }
      }
    }
  }

  visitBlocks(document?.children || []);
  return items;
}

function buildCurrentArticleLinkModalPayload(context, translate) {
  const label = context.editor?.state?.selection?.empty
    ? ""
    : context.editor.state.doc.textBetween(
        context.editor.state.selection.from,
        context.editor.state.selection.to,
        " ",
      );
  const document = context.getDocument();
  const headingOptions = extractHeadingMenuItems(document, {
    minLevel: 1,
    maxLevel: 3,
  }).map((item) => ({
    id: item.id,
    text: item.text,
    level: item.level,
  }));
  const formulaOptions = extractEquationTargets(document, translate);
  const anchorOptions = extractAnchorTargets(document);
  const defaultLinkType = headingOptions.length
    ? ("section" as const)
    : formulaOptions.length
      ? ("formula" as const)
      : ("anchor" as const);
  const defaultTargetId =
    defaultLinkType === "section"
      ? headingOptions[0]?.id || ""
      : defaultLinkType === "formula"
        ? formulaOptions[0]?.id || ""
        : anchorOptions[0]?.id || "";

  return {
    label,
    linkType: defaultLinkType,
    targetId: defaultTargetId,
    headingOptions,
    formulaOptions,
    anchorOptions,
  };
}

function buildDefaultTools(t, helpers: DefaultEditorToolBuilderHelpers = {}) {
  const legacyToolMap = buildLegacyToolMap(helpers);
  return [
    createEditorTool({
      key: "paragraph",
      name: t("editor.toolbar.paragraph", "Paragraph"),
      icon: <ParagraphIcon />,
      group: 1,
      order: 1,
      subTools: ["h1", "h2", "h3", "h4", "h5"],
      ...legacyToolMap.paragraph,
    }),
    createEditorTool({
      key: "h1",
      name: t("editor.toolbar.h1", "Heading 1"),
      icon: <Heading1Icon />,
      group: 1,
      order: 2,
      isActive: (context) =>
        context.editor?.isActive?.("heading", { level: 1 }) || false,
      executeVisual: (context) =>
        context.editor?.chain?.().focus().toggleHeading({ level: 1 }).run(),
    }),
    createEditorTool({
      key: "h2",
      name: t("editor.toolbar.h2", "Heading 2"),
      icon: <Heading2Icon />,
      group: 1,
      order: 3,
      isActive: (context) =>
        context.editor?.isActive?.("heading", { level: 2 }) || false,
      executeVisual: (context) =>
        context.editor?.chain?.().focus().toggleHeading({ level: 2 }).run(),
    }),
    createEditorTool({
      key: "h3",
      name: t("editor.toolbar.h3", "Heading 3"),
      icon: <Heading3Icon />,
      group: 1,
      order: 4,
      isActive: (context) =>
        context.editor?.isActive?.("heading", { level: 3 }) || false,
      executeVisual: (context) =>
        context.editor?.chain?.().focus().toggleHeading({ level: 3 }).run(),
    }),
    createEditorTool({
      key: "h4",
      name: t("editor.toolbar.h4", "Heading 4"),
      icon: <Heading4Icon />,
      group: 1,
      order: 5,
      isActive: (context) =>
        context.editor?.isActive?.("heading", { level: 4 }) || false,
      executeVisual: (context) =>
        context.editor?.chain?.().focus().toggleHeading({ level: 4 }).run(),
    }),
    createEditorTool({
      key: "h5",
      name: t("editor.toolbar.h5", "Heading 5"),
      icon: <Heading5Icon />,
      group: 1,
      order: 6,
      isActive: (context) =>
        context.editor?.isActive?.("heading", { level: 5 }) || false,
      executeVisual: (context) =>
        context.editor?.chain?.().focus().toggleHeading({ level: 5 }).run(),
    }),
    createEditorTool({
      key: "text-style",
      name: t("editor.toolbar.bold", "Bold"),
      icon: <BoldIcon />,
      group: 1,
      order: 7,
      subTools: ["italic", "strike", "underline", "color"],
      ...legacyToolMap["text-style"],
    }),
    createEditorTool({
      key: "italic",
      name: t("editor.toolbar.italic", "Italic"),
      icon: <ItalicIcon />,
      group: 1,
      order: 9,
      isActive: (context) => context.editor?.isActive?.("italic") || false,
      executeVisual: (context) =>
        context.editor?.chain?.().focus().toggleItalic().run(),
      markdownInsert: "*text*",
    }),
    createEditorTool({
      key: "strike",
      name: t("editor.toolbar.strike", "Strike"),
      icon: <StrikeIcon />,
      group: 1,
      order: 10,
      isActive: (context) => context.editor?.isActive?.("strike") || false,
      executeVisual: (context) =>
        context.editor?.chain?.().focus().toggleStrike().run(),
      markdownInsert: "~~text~~",
    }),
    createEditorTool({
      key: "underline",
      name: t("editor.toolbar.underline", "Underline"),
      icon: <UnderlineIcon />,
      group: 1,
      order: 11,
      isActive: (context) => context.editor?.isActive?.("underline") || false,
      executeVisual: (context) =>
        context.editor?.chain?.().focus().toggleUnderline().run(),
      markdownInsert: "++text++",
    }),
    createEditorTool({
      key: "color",
      name: t("editor.toolbar.color", "Color"),
      icon: <ColorIcon />,
      group: 1,
      order: 12,
      markdownInsert: "[Text]{.md-color-blue}",
      onClick: (context) => context.openInlinePanel("color"),
    }),
    createEditorTool({
      key: "lists",
      name: t("editor.toolbar.lists", "Lists"),
      icon: <BulletListIcon />,
      group: 1,
      order: 13,
      subTools: ["ordered-list", "task-list"],
      ...legacyToolMap.lists,
    }),
    createEditorTool({
      key: "ordered-list",
      name: t("editor.toolbar.orderedList", "Ordered List"),
      icon: <OrderedListIcon />,
      group: 1,
      order: 15,
      isActive: (context) => context.editor?.isActive?.("orderedList") || false,
      executeVisual: (context) =>
        context.editor?.chain?.().focus().toggleOrderedList().run(),
      markdownInsert: "1. item",
    }),
    createEditorTool({
      key: "task-list",
      name: t("editor.toolbar.taskList", "Checkbox List"),
      icon: <CheckboxListIcon />,
      group: 1,
      order: 16,
      isActive: (context) => context.editor?.isActive?.("taskList") || false,
      executeVisual: (context) =>
        context.editor?.chain?.().focus().toggleTaskList().run(),
      markdownInsert: "- [ ] item",
    }),
    createEditorTool({
      key: "horizontal-rule",
      name: t("editor.toolbar.horizontalRule", "Divider"),
      icon: <HorizontalRuleIcon />,
      group: 1,
      order: 17,
      subTools: ["anchor"],
      executeVisual: (context) =>
        context.editor?.chain?.().focus().setHorizontalRule().run(),
      markdownInsert: "---",
    }),
    createEditorTool({
      key: "anchor",
      name: t("editor.toolbar.anchor", "Anchor"),
      icon: <AnchorIcon />,
      group: 1,
      order: 18,
      onClick: (context) => context.openModal("anchor"),
    }),
    createEditorTool({
      key: "code",
      name: t("editor.toolbar.code", "Inline Code"),
      icon: <InlineCodeIcon />,
      group: 2,
      order: 1,
      subTools: ["code-block", "html"],
      ...legacyToolMap.code,
    }),
    createEditorTool({
      key: "code-block",
      name: t("editor.toolbar.codeBlock", "Code Block"),
      icon: <CodeBlockIcon />,
      group: 2,
      order: 2,
      isActive: (context) => context.editor?.isActive?.("codeBlock") || false,
      executeVisual: (context) =>
        context.runVisualCommand(() =>
          context.editor
            ?.chain?.()
            .focus()
            .toggleCodeBlock({ language: "text" })
            .run(),
        ),
      markdownInsert: "```text\ncode\n```",
      contextNodeTypes: ["codeBlock"],
      getContextMenuGroups: ({ toolContext, contextNode, updateNodeAttrs }) => {
        if (!contextNode) {
          return [];
        }
        return [
          {
            group: 4,
            children: EDITOR_CODE_LANGUAGES.map((language) => ({
              key: `code-language-${language.value}`,
              label: toolContext.translate(
                language.labelKey,
                language.fallback,
              ),
              icon: <CodeBlockIcon />,
              onClick: () =>
                updateNodeAttrs(contextNode.pos, { language: language.value }),
            })),
          },
        ];
      },
    }),
    createEditorTool({
      key: "math",
      name: t("editor.toolbar.math", "Inline Math"),
      icon: <InlineMathIcon />,
      group: 2,
      order: 3,
      subTools: ["math-block"],
      ...legacyToolMap.math,
    }),
    createEditorTool({
      key: "math-block",
      name: t("editor.toolbar.mathBlock", "Math Block"),
      icon: <MathBlockIcon />,
      group: 2,
      order: 4,
      ...legacyToolMap["math-block"],
    }),
    createEditorTool({
      key: "blocks",
      name: t("editor.toolbar.blocks", "Quote"),
      icon: <QuoteIcon />,
      group: 2,
      order: 5,
      subTools: ["collapsible-admonition", "tabs"],
      ...legacyToolMap.blocks,
    }),
    createEditorTool({
      key: "collapsible-admonition",
      name: t("editor.toolbar.admonition", "Admonition"),
      icon: <AdmonitionIcon />,
      group: 2,
      order: 7,
      contextNodeTypes: ["admonitionBlock"],
      markdownInsert: '???+ note "title"\n    body',
      executeVisual(context) {
        context.runVisualInsertCommand(() =>
          context.editor
            ?.chain?.()
            .focus()
            .insertContent({
              type: "admonitionBlock",
              attrs: createDefaultAdmonitionBlockAttrs(),
              content: [{ type: "paragraph" }],
            })
            .run(),
        );
      },
      getContextMenuGroups({ toolContext, contextNode, updateNodeAttrs }) {
        if (!contextNode) {
          return [];
        }
        const attrs = contextNode.node.attrs || {};
        return [
          {
            group: 8,
            children: ["note", "tip", "warning", "error"].map((variant) => ({
              key: `admonition-${variant}`,
              label: toolContext.translate(
                `editor.admonition.variant.${variant}`,
                variant[0].toUpperCase() + variant.slice(1),
              ),
              icon: <RendererAdmonitionIcon variant={variant as any} />,
              onClick: () => updateNodeAttrs(contextNode.pos, { variant }),
            })),
          },
          {
            group: 9,
            children: [
              {
                key:
                  attrs.collapsible === false
                    ? "make-collapsible"
                    : "make-static",
                label:
                  attrs.collapsible === false
                    ? toolContext.translate(
                        "editor.context.makeCollapsible",
                        "Collapsible",
                      )
                    : toolContext.translate(
                        "editor.context.makeStatic",
                        "Not collapsible",
                      ),
                icon:
                  attrs.collapsible === false ? (
                    <ChevronRightIcon />
                  ) : (
                    <ChevronDownIcon />
                  ),
                onClick: () =>
                  updateNodeAttrs(contextNode.pos, {
                    collapsible: attrs.collapsible === false,
                    defaultOpen: true,
                  }),
              },
              ...(attrs.collapsible === false
                ? []
                : [
                    {
                      key: "default-collapsed",
                      label:
                        attrs.defaultOpen === false
                          ? toolContext.translate(
                              "editor.context.defaultExpanded",
                              "Default expanded",
                            )
                          : toolContext.translate(
                              "editor.context.defaultCollapsed",
                              "Default collapsed",
                            ),
                      icon:
                        attrs.defaultOpen === false ? (
                          <ChevronDownIcon />
                        ) : (
                          <ChevronRightIcon />
                        ),
                      onClick: () =>
                        updateNodeAttrs(contextNode.pos, {
                          defaultOpen: attrs.defaultOpen === false,
                        }),
                    },
                  ]),
            ],
          },
        ];
      },
    }),
    createEditorTool({
      key: "tabs",
      name: t("editor.toolbar.tabs", "Tabs"),
      icon: <TabsIcon />,
      group: 2,
      order: 8,
      contextNodeTypes: ["tabsBlock"],
      markdownInsert: '=== "title"\n    body',
      executeVisual(context) {
        context.runVisualInsertCommand(() =>
          context.editor
            ?.chain?.()
            .focus()
            .insertContent({
              type: "tabsBlock",
              attrs: { indent: 0 },
              content: createDefaultTabsBlockContent(
                t("editor.default.tabLabel", "Tab {index}"),
              ),
            })
            .run(),
        );
      },
    }),
    createEditorTool({
      key: "table",
      name: t("editor.toolbar.table", "Table"),
      icon: <TableIcon />,
      group: 2,
      order: 9,
      subTools: ["import-csv-tsv", "import-xlsx"],
      onClick: (context) => context.openInlinePanel("table"),
      markdownInsert: "| Header |\n| --- |\n| Cell |",
      contextNodeTypes: ["table"],
      getContextMenuGroups: ({ toolContext, target }) => {
        if (
          !target?.closest("td,th") ||
          !toolContext.editor?.isActive?.("table")
        ) {
          return [];
        }
        return [
          {
            group: 1,
            children: [
              {
                key: "table-row-add",
                label: toolContext.translate(
                  "editor.context.addRowBelow",
                  "Add row below",
                ),
                icon: <AddIcon />,
                onClick: () =>
                  toolContext.editor.chain().focus().addRowAfter().run(),
              },
              {
                key: "table-column-add",
                label: toolContext.translate(
                  "editor.context.addColumnRight",
                  "Add column right",
                ),
                icon: <AddIcon />,
                onClick: () =>
                  toolContext.editor.chain().focus().addColumnAfter().run(),
              },
            ],
          },
          {
            group: 2,
            children: [
              {
                key: "table-row-delete",
                label: toolContext.translate(
                  "editor.context.deleteRow",
                  "Delete row",
                ),
                icon: <DeleteIcon />,
                danger: true,
                onClick: () =>
                  toolContext.editor.chain().focus().deleteRow().run(),
              },
              {
                key: "table-column-delete",
                label: toolContext.translate(
                  "editor.context.deleteColumn",
                  "Delete column",
                ),
                icon: <DeleteIcon />,
                danger: true,
                onClick: () =>
                  toolContext.editor.chain().focus().deleteColumn().run(),
              },
            ],
          },
        ];
      },
    }),
    createEditorTool({
      key: "import-csv-tsv",
      name: t("editor.toolbar.importCsvTsv", "Import from CSV/TSV"),
      icon: <TableIcon />,
      group: 2,
      order: 10,
      executeVisual: (context) => context.openDelimitedTableFilePicker?.(),
      executeMarkdown: (context) => context.openDelimitedTableFilePicker?.(),
    }),
    createEditorTool({
      key: "import-xlsx",
      name: t("editor.toolbar.importXlsx", "Import from XLS/XLSX"),
      icon: <TableIcon />,
      group: 2,
      order: 11,
      executeVisual: (context) => context.openSpreadsheetTableFilePicker?.(),
      executeMarkdown: (context) => context.openSpreadsheetTableFilePicker?.(),
    }),
    createEditorTool({
      key: "link",
      name: t("editor.toolbar.link", "Link"),
      icon: <LinkIcon />,
      group: 3,
      order: 1,
      subTools: ["link-current-article"],
      executeVisual: (context) =>
        context.openModal("link", buildLinkModalPayload(context.editor)),
      markdownInsert: "[label](https://example.com)",
      contextNodeTypes: ["link"],
      getContextMenuGroups: ({ toolContext, target }) => {
        const linkData =
          helpers.getContextLinkData?.(toolContext.editor, target) || null;
        if (!linkData) {
          return [];
        }
        return [
          {
            group: 12,
            children: [
              {
                key: "modify-link",
                label: toolContext.translate("editor.context.modify", "Modify"),
                icon: <LinkIcon />,
                onClick: () => {
                  toolContext.editor
                    .chain()
                    .focus()
                    .setTextSelection({ from: linkData.from, to: linkData.to })
                    .run();
                  toolContext.openModal("link", {
                    href: linkData.href,
                    label: linkData.label || "",
                    title: linkData.title,
                  });
                },
              },
              {
                key: "unlink",
                label: toolContext.translate("editor.context.unlink", "Unlink"),
                icon: <DeleteIcon />,
                onClick: () => {
                  toolContext.editor
                    .chain()
                    .focus()
                    .setTextSelection({ from: linkData.from, to: linkData.to })
                    .extendMarkRange("link")
                    .unsetLink()
                    .run();
                },
              },
            ],
          },
        ];
      },
    }),
    createEditorTool({
      key: "link-current-article",
      name: t("editor.toolbar.linkCurrentArticle", "Link to current article"),
      icon: <LinkIcon />,
      group: 3,
      order: 2,
      executeVisual: (context) =>
        context.openModal(
          "link-current-article",
          buildCurrentArticleLinkModalPayload(context, t),
        ),
      markdownInsert: "[Section](#heading)",
    }),
    createEditorTool({
      key: "image",
      name: t("editor.toolbar.image", "Image"),
      icon: <ImageIcon />,
      group: 3,
      order: 3,
      contextNodeTypes: ["imageBlock"],
      markdownInsert: "![Alt text](https://example.com/image.png)",
      executeVisual(context) {
        context.openModal("image");
      },
      getContextMenuGroups({ toolContext, contextNode }) {
        if (!contextNode) {
          return [];
        }
        return [
          {
            group: 1,
            children: [
              {
                key: "modify-image",
                label: toolContext.translate("editor.context.modify", "Modify"),
                icon: <ImageIcon />,
                onClick: () =>
                  toolContext.openModal("image", {
                    pos: contextNode.pos,
                    ...(contextNode.node.attrs || {}),
                  }),
              },
            ],
          },
        ];
      },
    }),
    createEditorTool({
      key: "video",
      name: t("editor.toolbar.video", "Video"),
      icon: <VideoIcon />,
      group: 3,
      order: 4,
      contextNodeTypes: ["videoBlock"],
      markdownInsert:
        '::video{src="https://example.com/demo.mp4" title="Demo"}',
      executeVisual(context) {
        context.openModal("video");
      },
      getContextMenuGroups({ toolContext, contextNode }) {
        if (!contextNode) {
          return [];
        }
        return [
          {
            group: 1,
            children: [
              {
                key: "modify-video",
                label: toolContext.translate("editor.context.modify", "Modify"),
                icon: <VideoIcon />,
                onClick: () =>
                  toolContext.openModal("video", {
                    pos: contextNode.pos,
                    ...(contextNode.node.attrs || {}),
                  }),
              },
            ],
          },
        ];
      },
    }),
    createEditorTool({
      key: "html",
      name: t("editor.toolbar.html", "HTML"),
      icon: <HtmlIcon />,
      group: 2,
      order: 3,
      executeVisual(context) {
        context.openModal("html");
      },
      onClick(context) {
        context.openModal("html");
      },
      markdownInsert: "::html\n:: <div>Hello</div>",
      customBlock: {
        kind: "html",
        data: { html: "" },
        render({ data }) {
          return (
            <HtmlPreviewBlock
              html={String(data?.html || "")}
              title={t("editor.a11y.htmlPreview", "HTML preview")}
            />
          );
        },
        getContextMenuGroups({ data, pos, openModal, translate }) {
          return [
            {
              group: 1,
              children: [
                {
                  key: "modify-html",
                  label: translate("editor.context.modify", "Modify"),
                  icon: <HtmlIcon />,
                  onClick: () =>
                    openModal("html", { pos, html: String(data?.html || "") }),
                },
              ],
            },
          ];
        },
      },
    }),
    createEditorTool({
      key: "markdown",
      name: t("editor.toolbar.markdown", "Markdown"),
      icon: <MarkdownIcon />,
      group: 4,
      order: 1,
    }),
    createEditorTool({
      key: "navigation",
      name: t("editor.toolbar.navigation", "Navigation"),
      icon: <NavigationIcon />,
      group: 4,
      order: 2,
      isActive: (context) => context.navigationOpen,
    }),
    createEditorTool({
      key: "fullscreen-editor",
      name: t("editor.toolbar.fullscreen", "Fullscreen"),
      icon: <FullscreenIcon />,
      group: 4,
      order: 3,
      executeVisual: (context) => context.openModal("fullscreen-editor"),
      isDisabled: (context) => context.mode !== "visual",
    }),
  ] satisfies EditorToolDefinition[];
}

export function buildDefaultEditorTools(
  translate: EditorTranslate,
  helpers: DefaultEditorToolBuilderHelpers = {},
) {
  const t = (key: string, fallback: string) =>
    translateLabel(translate, key, fallback);
  return buildDefaultTools(t, helpers);
}
