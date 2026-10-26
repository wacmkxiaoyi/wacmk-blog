import type { BlockNode, ContentDocument, InlineNode } from "../schema";
import type { ContentNode, ContentPlugin } from "./types";

function mapInlineNode(node: InlineNode, plugins: ContentPlugin[]): InlineNode {
  const transformed = plugins.reduce((currentNode, plugin) => {
    if (!plugin.transformNode) {
      return currentNode;
    }
    return plugin.transformNode(currentNode as ContentNode) as InlineNode;
  }, node);

  if (transformed.type === "link") {
    return {
      ...transformed,
      children: transformed.children.map((child) =>
        mapInlineNode(child, plugins),
      ),
    };
  }

  return transformed;
}

function mapBlockNode(node: BlockNode, plugins: ContentPlugin[]): BlockNode {
  const transformed = plugins.reduce((currentNode, plugin) => {
    if (!plugin.transformNode) {
      return currentNode;
    }
    return plugin.transformNode(currentNode as ContentNode) as BlockNode;
  }, node);

  switch (transformed.type) {
    case "paragraph":
    case "heading":
      return {
        ...transformed,
        children: transformed.children.map((child) =>
          mapInlineNode(child, plugins),
        ),
      };
    case "blockquote":
      return {
        ...transformed,
        children: transformed.children.map((child) =>
          mapBlockNode(child, plugins),
        ),
      };
    case "list":
      return {
        ...transformed,
        items: transformed.items.map((item) => ({
          ...item,
          children: item.children.map((child) => mapBlockNode(child, plugins)),
        })),
      };
    case "table":
      return {
        ...transformed,
        head: transformed.head
          ? {
              ...transformed.head,
              cells: transformed.head.cells.map((cell) => ({
                ...cell,
                children: cell.children.map((child) =>
                  mapBlockNode(child, plugins),
                ),
              })),
            }
          : undefined,
        body: transformed.body.map((row) => ({
          ...row,
          cells: row.cells.map((cell) => ({
            ...cell,
            children: cell.children.map((child) =>
              mapBlockNode(child, plugins),
            ),
          })),
        })),
      };
    case "callout":
    case "admonition":
      return {
        ...transformed,
        children: transformed.children.map((child) =>
          mapBlockNode(child, plugins),
        ),
      };
    case "tabs":
      return {
        ...transformed,
        items: transformed.items.map((item) => ({
          ...item,
          children: item.children.map((child) => mapBlockNode(child, plugins)),
        })),
      };
    case "image":
    case "video":
    case "custom":
      return {
        ...transformed,
        caption: transformed.caption
          ? transformed.caption.map((child) => mapInlineNode(child, plugins))
          : undefined,
      };
    default:
      return transformed;
  }
}

export function runPlugins(
  document: ContentDocument,
  plugins: ContentPlugin[],
) {
  const transformedChildren = document.children.map((child) =>
    mapBlockNode(child, plugins),
  );
  const transformedDocument = { ...document, children: transformedChildren };

  return plugins.reduce((currentDocument, plugin) => {
    if (!plugin.transformDocument) {
      return currentDocument;
    }
    return plugin.transformDocument(currentDocument);
  }, transformedDocument);
}
