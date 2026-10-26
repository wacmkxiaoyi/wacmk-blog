import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { getContentAnchorIdAttributeName } from "../../navigation";

export function MathBlockRenderer({ node, context }) {
  const html = React.useMemo(() => {
    try {
      return katex.renderToString(node.value, {
        displayMode: true,
        throwOnError: false,
      });
    } catch (_error) {
      return null;
    }
  }, [node.value]);
  const blockPath = context?.currentBlockPath;
  const equationIndex = blockPath
    ? context?.document?.equationNumbersByPath?.[blockPath] || null
    : null;
  const anchorId = blockPath
    ? context?.document?.equationIdsByPath?.[blockPath]
    : undefined;
  const anchorAttrName = getContentAnchorIdAttributeName();

  const content = html ? (
    <div
      className="cr-math-block-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : (
    <pre className="cr-math-block-content cr-math-block-content--fallback">
      {node.value}
    </pre>
  );

  return (
    <div
      className="cr-math-block-shell"
      id={anchorId}
      {...(anchorId ? { [anchorAttrName]: anchorId } : {})}
    >
      <div className="cr-math-block">
        {content}
        {equationIndex ? (
          <span className="cr-math-block-number">({equationIndex})</span>
        ) : null}
      </div>
    </div>
  );
}
