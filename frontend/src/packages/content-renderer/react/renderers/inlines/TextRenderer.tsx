import React from "react";
import { normalizeMarks } from "../../../core";

const MARK_ORDER = {
  color: 1,
  highlight: 2,
  italic: 3,
  bold: 4,
  underline: 5,
  strike: 6,
};

function applyMark(content, mark, index) {
  switch (mark.type) {
    case "bold":
      return <strong key={`mark-${index}`}>{content}</strong>;
    case "italic":
      return <em key={`mark-${index}`}>{content}</em>;
    case "strike":
      return <del key={`mark-${index}`}>{content}</del>;
    case "underline":
      return <u key={`mark-${index}`}>{content}</u>;
    case "color":
      return (
        <span
          key={`mark-${index}`}
          className={`cr-text-color cr-text-color-${mark.value}`}
        >
          {content}
        </span>
      );
    case "highlight":
      return <mark key={`mark-${index}`}>{content}</mark>;
    default:
      return content;
  }
}

export function TextRenderer({ node }) {
  const marks = normalizeMarks(node.marks)
    .slice()
    .sort((left, right) => {
      return (MARK_ORDER[left.type] || 99) - (MARK_ORDER[right.type] || 99);
    });
  const content = marks.reduce(
    (currentContent, mark, index) => applyMark(currentContent, mark, index),
    node.value,
  );
  return <>{content}</>;
}
