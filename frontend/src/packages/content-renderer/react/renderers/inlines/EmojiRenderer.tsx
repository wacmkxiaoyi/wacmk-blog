import React from "react";

export function EmojiRenderer({ node }) {
  return <span className="cr-emoji">{node.value}</span>;
}
