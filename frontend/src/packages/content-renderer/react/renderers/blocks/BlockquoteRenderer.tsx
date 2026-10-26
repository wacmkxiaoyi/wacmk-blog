import React from "react";
import { renderBlockChildren } from "../../utils";

export function BlockquoteRenderer({ node, context }) {
  return (
    <blockquote className="cr-blockquote">
      {renderBlockChildren(
        node.children,
        context,
        `${context.currentBlockPath}.children`,
      )}
    </blockquote>
  );
}
