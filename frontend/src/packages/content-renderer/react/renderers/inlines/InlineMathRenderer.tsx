import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

export function InlineMathRenderer({ node }) {
  const html = React.useMemo(() => {
    try {
      return katex.renderToString(node.value, {
        displayMode: false,
        throwOnError: false,
      });
    } catch (_error) {
      return null;
    }
  }, [node.value]);

  if (!html) {
    return <span className="cr-inline-math">{node.value}</span>;
  }

  return (
    <span
      className="cr-inline-math"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
