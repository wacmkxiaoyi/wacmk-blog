import {
  MarkdownPreset,
  createDocument,
  type BlockNode,
  type ContentDocument,
  type InlineNode,
  type TextMark,
} from "../../content-renderer/index.ts";
import { serializeDocumentToMarkdown } from "../../content-renderer/presets/markdown/serialize/index.ts";

export function buildHeadingSlug(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[\s\u3000]+/g, "-")
    .replace(/[^\w\-\u4e00-\u9fff]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function createStableHeadingId(text: string, usedIds: Set<string>) {
  const base = buildHeadingSlug(text) || "heading";
  let nextId = base;
  let suffix = 2;

  while (usedIds.has(nextId)) {
    nextId = `${base}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(nextId);
  return nextId;
}
function parseMarkdownDocument(value: string) {
  return createDocument({
    format: "markdown",
    value: value || "",
    adapter: MarkdownPreset.adapter,
    plugins: MarkdownPreset.plugins,
  });
}

function createTextNode(text: string, marks?: TextMark[]): InlineNode | null {
  if (!text) {
    return null;
  }
  return {
    type: "text",
    value: text,
    marks: Array.isArray(marks) && marks.length ? marks : undefined,
  };
}

function cloneMark(mark: Record<string, unknown>) {
  if (mark.type === "link") {
    return {
      type: "link",
      attrs: { href: mark.attrs?.href || "", title: mark.attrs?.title || "" },
    };
  }
  if (mark.type === "colorToken") {
    return { type: "colorToken", attrs: { token: mark.attrs?.token } };
  }
  return mark;
}

function appendMark(
  marks: Array<Record<string, unknown>> | undefined,
  mark: Record<string, unknown>,
) {
  return [...(marks || []), cloneMark(mark)];
}

function flattenInlineNode(node: InlineNode): Array<Record<string, unknown>> {
  switch (node.type) {
    case "text": {
      const marks = Array.isArray(node.marks)
        ? node.marks.map((mark) => {
            if (mark.type === "color") {
              return { type: "colorToken", attrs: { token: mark.value } };
            }
            return { type: mark.type };
          })
        : undefined;
      return [{ type: "text", text: node.value, marks }];
    }
    case "link":
      return (node.children || []).flatMap((child) => {
        return flattenInlineNode(child).map((entry) => ({
          ...entry,
          marks: appendMark(entry.marks, {
            type: "link",
            attrs: { href: node.href, title: node.title || "" },
          }),
        }));
      });
    case "inline-code":
      return [
        { type: "text", text: node.value || "", marks: [{ type: "code" }] },
      ];
    case "inline-math":
      return [{ type: "inlineMath", attrs: { value: node.value || "" } }];
    case "line-break":
      return [{ type: "hardBreak" }];
    case "emoji":
      return [{ type: "text", text: node.value || "" }];
    case "checkbox":
      return [{ type: "text", text: node.checked ? "[x]" : "[]" }];
    default:
      return [];
  }
}

function contentInlineToEditor(nodes: InlineNode[]) {
  return (nodes || []).flatMap(flattenInlineNode);
}

function contentBlockToEditor(node: BlockNode): Record<string, unknown> | null {
  switch (node.type) {
    case "paragraph":
      return {
        type: "paragraph",
        content: contentInlineToEditor(node.children || []),
      };
    case "heading":
      return {
        type: "heading",
        attrs: {
          level: node.level || 1,
          id: node.id || null,
        },
        content: contentInlineToEditor(node.children || []),
      };
    case "blockquote":
      return {
        type: "blockquote",
        content: (node.children || [])
          .map(contentBlockToEditor)
          .filter(Boolean),
      };
    case "list": {
      if (node.items.some((item) => item.checked != null)) {
        return {
          type: "taskList",
          content: node.items.map((item) => ({
            type: "taskItem",
            attrs: { checked: Boolean(item.checked) },
            content: (item.children || [])
              .map(contentBlockToEditor)
              .filter(Boolean),
          })),
        };
      }
      return {
        type: node.ordered ? "orderedList" : "bulletList",
        attrs: node.ordered ? { start: node.start || 1 } : undefined,
        content: node.items.map((item) => ({
          type: "listItem",
          content: (item.children || [])
            .map(contentBlockToEditor)
            .filter(Boolean),
        })),
      };
    }
    case "code-block":
      return {
        type: "codeBlock",
        attrs: { language: node.language || "text" },
        content: [{ type: "text", text: node.value || "" }],
      };
    case "table": {
      const rows = [];
      if (node.head?.cells?.length) {
        rows.push({
          type: "tableRow",
          content: node.head.cells.map((cell) => ({
            type: "tableHeader",
            attrs: { align: cell.align || null },
            content: (cell.children || [])
              .map(contentBlockToEditor)
              .filter(Boolean),
          })),
        });
      }
      (node.body || []).forEach((row) => {
        rows.push({
          type: "tableRow",
          content: row.cells.map((cell) => ({
            type: cell.header ? "tableHeader" : "tableCell",
            attrs: { align: cell.align || null },
            content: (cell.children || [])
              .map(contentBlockToEditor)
              .filter(Boolean),
          })),
        });
      });
      return { type: "table", content: rows };
    }
    case "horizontal-rule":
      return { type: "horizontalRule" };
    case "anchor":
      return {
        type: "anchorBlock",
        attrs: { id: buildHeadingSlug(String(node.id || "")) || "anchor" },
      };
    case "math-block":
      return { type: "mathBlock", attrs: { value: node.value || "" } };
    case "admonition":
      return {
        type: "admonitionBlock",
        attrs: {
          variant: node.variant,
          title: node.title || "",
          collapsible: node.collapsible !== false,
          defaultOpen: node.defaultOpen !== false,
          indent: 0,
        },
        content: (node.children || [])
          .map(contentBlockToEditor)
          .filter(Boolean),
      };
    case "tabs":
      return {
        type: "tabsBlock",
        attrs: { indent: 0 },
        content: (node.items || []).map((item, index) => ({
          type: "tabItem",
          attrs: {
            key: item.key || `tab-${index + 1}`,
            label: item.label || "title",
          },
          content: (item.children || [])
            .map(contentBlockToEditor)
            .filter(Boolean),
        })),
      };
    case "image":
      return {
        type: "imageBlock",
        attrs: {
          src: node.src || "",
          alt: node.alt || "",
          title: node.title || "",
          width: node.width,
          height: node.height,
        },
      };
    case "video":
      return {
        type: "videoBlock",
        attrs: {
          src: node.src || "",
          title: node.title || "",
          poster: node.poster || "",
          caption: node.caption ? serializeInlineNodesToText(node.caption) : "",
        },
      };
    case "custom":
      return {
        type: "customBlock",
        attrs: {
          kind: node.kind || "custom",
          data: node.data || {},
          indent: 0,
        },
      };
    case "callout":
      return {
        type: "admonitionBlock",
        attrs: {
          variant:
            node.variant === "important"
              ? "note"
              : node.variant === "caution"
                ? "warning"
                : node.variant,
          title: node.title || "",
          collapsible: false,
          defaultOpen: true,
          indent: 0,
        },
        content: (node.children || [])
          .map(contentBlockToEditor)
          .filter(Boolean),
      };
    default:
      return {
        type: "paragraph",
        content: [{ type: "text", text: `[Unsupported ${node.type}]` }],
      };
  }
}

function serializeInlineNodesToText(nodes: InlineNode[]) {
  return (nodes || [])
    .map((node) => {
      if (node.type === "text") {
        return node.value || "";
      }
      if (node.type === "emoji") {
        return node.value || "";
      }
      if (node.type === "inline-code") {
        return node.value || "";
      }
      if (node.type === "link") {
        return serializeInlineNodesToText(node.children || []);
      }
      if (node.type === "inline-math") {
        return node.value || "";
      }
      return "";
    })
    .join("");
}

function assignHeadingIdsToContentBlocks(blocks: BlockNode[]) {
  const usedIds = new Set<string>();

  return (blocks || []).map((block) => {
    if (block?.type !== "heading") {
      return block;
    }

    const text = serializeInlineNodesToText(block.children || []);
    const nextId =
      block.id && !usedIds.has(block.id)
        ? (usedIds.add(block.id), block.id)
        : createStableHeadingId(text, usedIds);

    return {
      ...block,
      id: nextId,
      meta: {
        ...(block.meta || {}),
        anchorable: block.meta?.anchorable !== false,
        tocIncluded: block.meta?.tocIncluded !== false,
      },
    };
  });
}

export function createCustomBlockDocument(
  kind: string,
  data?: Record<string, unknown>,
) {
  return {
    type: "document",
    version: 1,
    format: "rich-text",
    children: [
      {
        type: "custom",
        kind,
        data: data || {},
      },
    ],
  } as ContentDocument;
}

export function customBlockToMarkdown(
  kind: string,
  data?: Record<string, unknown>,
) {
  return serializeDocumentToMarkdown(createCustomBlockDocument(kind, data));
}

export function contentDocumentToEditorDoc(
  document: ContentDocument | null | undefined,
) {
  return {
    type: "doc",
    content: (document?.children || [])
      .map(contentBlockToEditor)
      .filter(Boolean),
  };
}

function mapTextMarks(
  marks: Array<Record<string, unknown>> | undefined,
): TextMark[] | undefined {
  const result = (marks || []).reduce<TextMark[]>((all, mark) => {
    switch (mark.type) {
      case "bold":
      case "italic":
      case "strike":
      case "underline":
        all.push({ type: mark.type });
        return all;
      case "colorToken":
        if (mark.attrs?.token) {
          all.push({ type: "color", value: String(mark.attrs.token) as any });
        }
        return all;
      default:
        return all;
    }
  }, []);
  return result.length ? result : undefined;
}

function editorInlineToContent(
  entries: Array<Record<string, unknown>>,
): InlineNode[] {
  const result: InlineNode[] = [];

  (entries || []).forEach((entry) => {
    if (!entry) {
      return;
    }

    if (entry.type === "hardBreak") {
      result.push({ type: "line-break" });
      return;
    }

    if (entry.type === "inlineMath") {
      result.push({
        type: "inline-math",
        value: String(entry.attrs?.value || ""),
      });
      return;
    }

    if (entry.type !== "text") {
      return;
    }

    const text = String(entry.text || "");
    const marks = Array.isArray(entry.marks) ? entry.marks : [];
    const linkMark = marks.find((mark) => mark.type === "link");
    const hasCode = marks.some((mark) => mark.type === "code");
    const textMarks = mapTextMarks(
      marks.filter((mark) => mark.type !== "link" && mark.type !== "code"),
    );

    let inlineNode: InlineNode | null;
    if (hasCode) {
      inlineNode = { type: "inline-code", value: text };
    } else {
      inlineNode = createTextNode(text, textMarks);
    }

    if (!inlineNode) {
      return;
    }

    if (linkMark) {
      const previous = result[result.length - 1];
      if (
        previous?.type === "link" &&
        previous.href === String(linkMark.attrs?.href || "") &&
        previous.title === (linkMark.attrs?.title || undefined)
      ) {
        previous.children.push(inlineNode);
      } else {
        result.push({
          type: "link",
          href: String(linkMark.attrs?.href || ""),
          title: linkMark.attrs?.title
            ? String(linkMark.attrs.title)
            : undefined,
          children: [inlineNode],
        });
      }
      return;
    }

    result.push(inlineNode);
  });

  return result;
}

function extractText(content: Array<Record<string, unknown>> | undefined) {
  return (content || [])
    .map((node) => {
      if (node.type === "text") {
        return String(node.text || "");
      }
      if (node.type === "hardBreak") {
        return "\n";
      }
      return "";
    })
    .join("");
}

function editorBlockToContent(node: Record<string, unknown>): BlockNode | null {
  switch (node.type) {
    case "paragraph":
      return {
        type: "paragraph",
        children: editorInlineToContent(
          (node.content as Array<Record<string, unknown>>) || [],
        ),
      };
    case "heading":
      return {
        type: "heading",
        level: Number(node.attrs?.level || 1) as 1 | 2 | 3 | 4 | 5 | 6,
        id:
          typeof node.attrs?.id === "string" && node.attrs.id.trim()
            ? String(node.attrs.id)
            : undefined,
        children: editorInlineToContent(
          (node.content as Array<Record<string, unknown>>) || [],
        ),
      };
    case "blockquote":
      return {
        type: "blockquote",
        children: ((node.content as Array<Record<string, unknown>>) || [])
          .map(editorBlockToContent)
          .filter(Boolean) as BlockNode[],
      };
    case "bulletList":
    case "orderedList":
      return {
        type: "list",
        ordered: node.type === "orderedList",
        start:
          node.type === "orderedList"
            ? Number(node.attrs?.start || 1)
            : undefined,
        items: ((node.content as Array<Record<string, unknown>>) || []).map(
          (item) => ({
            type: "list-item",
            children: ((item.content as Array<Record<string, unknown>>) || [])
              .map(editorBlockToContent)
              .filter(Boolean) as BlockNode[],
          }),
        ),
      };
    case "taskList":
      return {
        type: "list",
        ordered: false,
        items: ((node.content as Array<Record<string, unknown>>) || []).map(
          (item) => ({
            type: "list-item",
            checked: Boolean(item.attrs?.checked),
            children: ((item.content as Array<Record<string, unknown>>) || [])
              .map(editorBlockToContent)
              .filter(Boolean) as BlockNode[],
          }),
        ),
      };
    case "codeBlock":
      return {
        type: "code-block",
        language: String(node.attrs?.language || "text"),
        value: extractText(
          (node.content as Array<Record<string, unknown>>) || [],
        ),
      };
    case "horizontalRule":
      return { type: "horizontal-rule" };
    case "anchorBlock":
      return {
        type: "anchor",
        id: buildHeadingSlug(String(node.attrs?.id || "")) || "anchor",
      };
    case "table": {
      const rows = ((node.content as Array<Record<string, unknown>>) || []).map(
        (row) => ({
          type: "table-row",
          cells: ((row.content as Array<Record<string, unknown>>) || []).map(
            (cell) => ({
              type: "table-cell",
              header: cell.type === "tableHeader",
              align: cell.attrs?.align || null,
              children: ((cell.content as Array<Record<string, unknown>>) || [])
                .map(editorBlockToContent)
                .filter(Boolean) as BlockNode[],
            }),
          ),
        }),
      );
      const [firstRow, ...bodyRows] = rows;
      const hasHeader = firstRow?.cells?.every((cell) => cell.header);
      return {
        type: "table",
        align: firstRow?.cells?.map((cell) => cell.align || null),
        head: hasHeader ? firstRow : undefined,
        body: hasHeader ? bodyRows : rows,
      };
    }
    case "imageBlock":
      return {
        type: "image",
        src: String(node.attrs?.src || ""),
        alt: String(node.attrs?.alt || ""),
        title: node.attrs?.title ? String(node.attrs.title) : undefined,
        width: node.attrs?.width ? Number(node.attrs.width) : undefined,
        height: node.attrs?.height ? Number(node.attrs.height) : undefined,
      };
    case "videoBlock":
      return {
        type: "video",
        src: String(node.attrs?.src || ""),
        title: node.attrs?.title ? String(node.attrs.title) : undefined,
        poster: node.attrs?.poster ? String(node.attrs.poster) : undefined,
        caption: node.attrs?.caption
          ? [{ type: "text", value: String(node.attrs.caption) }]
          : undefined,
        controls: true,
      };
    case "mathBlock":
      return { type: "math-block", value: String(node.attrs?.value || "") };
    case "admonitionBlock":
      return {
        type: "admonition",
        variant: String(node.attrs?.variant || "note") as
          "note" | "tip" | "warning" | "error",
        title: node.attrs?.title ? String(node.attrs.title) : undefined,
        collapsible: Boolean(node.attrs?.collapsible),
        defaultOpen: node.attrs?.defaultOpen !== false,
        children: ((node.content as Array<Record<string, unknown>>) || [])
          .map(editorBlockToContent)
          .filter(Boolean) as BlockNode[],
      };
    case "tabsBlock":
      return {
        type: "tabs",
        items: ((node.content as Array<Record<string, unknown>>) || [])
          .filter((item) => item?.type === "tabItem")
          .map((item: Record<string, unknown>, index: number) => ({
            type: "tab-item",
            key: String(item.attrs?.key || `tab-${index + 1}`),
            label: String(item.attrs?.label || "title"),
            children: ((item.content as Array<Record<string, unknown>>) || [])
              .map(editorBlockToContent)
              .filter(Boolean) as BlockNode[],
          })),
      };
    case "customBlock":
      return {
        type: "custom",
        kind: String(node.attrs?.kind || "custom"),
        data:
          node.attrs?.data && typeof node.attrs.data === "object"
            ? (node.attrs.data as Record<string, unknown>)
            : {},
      };
    default:
      return null;
  }
}

export function editorDocToContentDocument(
  editorDoc: Record<string, unknown> | null | undefined,
): ContentDocument {
  const children = (
    (editorDoc?.content as Array<Record<string, unknown>>) || []
  )
    .map(editorBlockToContent)
    .filter(Boolean) as BlockNode[];
  return {
    type: "document",
    version: 1,
    format: "rich-text",
    children: assignHeadingIdsToContentBlocks(children),
  };
}

export function markdownToEditorDoc(markdown: string) {
  return contentDocumentToEditorDoc(parseMarkdownDocument(markdown));
}

export function editorDocToMarkdown(
  editorDoc: Record<string, unknown> | null | undefined,
) {
  return serializeDocumentToMarkdown(editorDocToContentDocument(editorDoc));
}
