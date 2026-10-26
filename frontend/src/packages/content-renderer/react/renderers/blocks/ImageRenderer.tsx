import React from "react";
import { renderInlineChildren } from "../../utils";

export function ImageRenderer({ node, context }) {
  const resolved =
    typeof context.resolvers.image === "function"
      ? { ...node, ...(context.resolvers.image(node, context) || {}) }
      : node;

  return (
    <figure className="cr-image-block">
      <img
        src={resolved.src}
        alt={resolved.alt || ""}
        title={resolved.title}
        width={resolved.width}
        height={resolved.height}
      />
      {resolved.caption?.length ? (
        <figcaption>
          {renderInlineChildren(resolved.caption, context)}
        </figcaption>
      ) : null}
    </figure>
  );
}
