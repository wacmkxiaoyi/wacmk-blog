import React from "react";

export function InlineCodeRenderer({ node }) {
  return <code className="cr-inline-code">{node.value}</code>;
}
