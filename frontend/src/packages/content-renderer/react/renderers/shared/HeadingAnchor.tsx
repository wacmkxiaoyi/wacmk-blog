import React from "react";

export function HeadingAnchor({ id, label, context }) {
  if (!id) {
    return null;
  }

  return (
    <a
      className="cr-heading-anchor"
      href={`#${id}`}
      aria-label={label}
      title={label}
      onClick={(event) => {
        if (
          !context?.anchors?.navigation?.enabled ||
          typeof context.anchors.navigateToHeading !== "function"
        ) {
          return;
        }
        event.preventDefault();
        context.anchors.navigateToHeading(id);
      }}
    >
      #
    </a>
  );
}
