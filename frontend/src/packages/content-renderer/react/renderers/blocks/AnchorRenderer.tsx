import React from "react";
import { getContentAnchorIdAttributeName } from "../../navigation";

export function AnchorRenderer({ node }) {
  const anchorAttrName = getContentAnchorIdAttributeName();

  return (
    <div
      id={node.id}
      {...(node.id ? { [anchorAttrName]: node.id } : {})}
      className="cr-anchor-block"
      aria-hidden="true"
    />
  );
}
