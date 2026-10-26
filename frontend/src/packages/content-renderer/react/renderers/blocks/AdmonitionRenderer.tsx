import React from "react";
import { renderBlockChildren } from "../../utils";
import { AdmonitionIcon } from "./admonitionIcons";

export function AdmonitionRenderer({ node, context }) {
  const summary = node.title || node.variant;
  const titleContent = (
    <>
      <span className="cr-admonition-icon">
        <AdmonitionIcon variant={node.variant} />
      </span>
      <span>{summary}</span>
    </>
  );

  if (node.collapsible === false) {
    return (
      <div className={`cr-admonition cr-admonition-${node.variant}`}>
        <div className="cr-admonition-summary">{titleContent}</div>
        <div className="cr-admonition-body">
          {renderBlockChildren(
            node.children,
            context,
            `${context.currentBlockPath}.children`,
          )}
        </div>
      </div>
    );
  }

  return (
    <details
      className={`cr-admonition cr-admonition-${node.variant}`}
      open={node.defaultOpen}
    >
      <summary className="cr-admonition-summary">{titleContent}</summary>
      <div className="cr-admonition-body">
        {renderBlockChildren(
          node.children,
          context,
          `${context.currentBlockPath}.children`,
        )}
      </div>
    </details>
  );
}
