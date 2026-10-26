import React from "react";
import { renderBlockChildren } from "../../utils";
import { AdmonitionIcon } from "./admonitionIcons";

export function CalloutRenderer({ node, context }) {
  return (
    <blockquote className={`cr-callout cr-callout-${node.variant}`}>
      <p className="cr-callout-title">
        <span className="cr-admonition-icon">
          <AdmonitionIcon variant={node.variant} />
        </span>
        <span>{node.title || node.variant}</span>
      </p>
      <div className="cr-callout-body">
        {renderBlockChildren(
          node.children,
          context,
          `${context.currentBlockPath}.children`,
        )}
      </div>
    </blockquote>
  );
}
