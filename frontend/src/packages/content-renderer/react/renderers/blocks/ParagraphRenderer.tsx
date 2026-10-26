import React from "react";
import { renderInlineChildren } from "../../utils";

export function ParagraphRenderer({ node, context }) {
  return (
    <p className="cr-paragraph">
      {renderInlineChildren(node.children, context)}
    </p>
  );
}
