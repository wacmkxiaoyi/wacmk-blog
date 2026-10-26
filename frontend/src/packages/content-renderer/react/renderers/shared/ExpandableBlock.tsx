import React, { useState } from "react";

export function ExpandableBlock({
  collapsed,
  labels,
  children,
  className = "",
}) {
  const [expanded, setExpanded] = useState(!collapsed);
  const showToggle = Boolean(collapsed);

  return (
    <div
      className={[
        "cr-expandable-block",
        className,
        expanded ? "is-expanded" : "is-collapsed",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="cr-expandable-block-body">{children(expanded)}</div>
      {showToggle ? (
        <button
          type="button"
          className="cr-expandable-toggle"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? labels.collapse : labels.expand}
        </button>
      ) : null}
    </div>
  );
}
