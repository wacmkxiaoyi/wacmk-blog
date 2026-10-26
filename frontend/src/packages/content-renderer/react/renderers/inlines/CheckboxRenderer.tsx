import React from "react";

export function CheckboxRenderer({ node }) {
  return (
    <span className="cr-inline-checkbox">
      <input type="checkbox" checked={node.checked} readOnly />
    </span>
  );
}
