import React from "react";
import { renderBlockNode } from "./renderBlockNode";
import { renderInlineNode } from "./renderInlineNode";

export function renderInlineChildren(nodes, context) {
  return (nodes || []).map((node, index) =>
    renderInlineNode(node, context, `inline-${index}`),
  );
}

export function renderBlockChildren(nodes, context, parentPath = "") {
  return (nodes || []).map((node, index) => {
    const path = parentPath ? `${parentPath}.${index}` : String(index);
    return renderBlockNode(
      node,
      { ...context, currentBlockPath: path },
      `block-${path}`,
    );
  });
}
