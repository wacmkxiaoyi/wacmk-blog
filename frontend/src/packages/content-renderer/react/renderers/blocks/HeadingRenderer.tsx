import React from "react";
import { renderInlineChildren } from "../../utils";
import { HeadingAnchor } from "../shared";

export function HeadingRenderer({ node, context }) {
  const Tag = `h${node.level}`;
  const showAnchor = context.options.enableHeadingAnchor !== false;
  const domId = context.anchors?.resolveHeadingDomId
    ? context.anchors.resolveHeadingDomId(node.id)
    : node.id;

  return (
    <Tag
      id={domId}
      data-content-heading-id={node.id}
      className={`cr-heading cr-heading-${node.level}`}
    >
      <span className="cr-heading-content">
        {renderInlineChildren(node.children, context)}
      </span>
      {showAnchor ? (
        <HeadingAnchor
          id={node.id}
          label={context.labels.permalink}
          context={context}
        />
      ) : null}
    </Tag>
  );
}
