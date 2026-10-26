import React from "react";
import { renderInlineChildren } from "../../utils";
import { parseAnchorHref } from "../../navigation";

export function LinkRenderer({ node, context }) {
  const resolved =
    typeof context.resolvers.link === "function"
      ? { ...node, ...(context.resolvers.link(node, context) || {}) }
      : node;
  const rel = resolved.meta?.noFollow ? "noreferrer nofollow" : "noreferrer";
  const target = resolved.meta?.openInNewTab ? "_blank" : undefined;
  const anchorId = parseAnchorHref(resolved.href);

  return (
    <a
      href={resolved.href}
      title={resolved.title}
      target={target}
      rel={target ? rel : undefined}
      onClick={(event) => {
        if (
          !anchorId ||
          target ||
          !context?.anchors?.navigation?.enabled ||
          typeof context.anchors.navigateToHeading !== "function"
        ) {
          return;
        }
        event.preventDefault();
        context.anchors.navigateToHeading(anchorId);
      }}
    >
      {renderInlineChildren(resolved.children, context)}
    </a>
  );
}
