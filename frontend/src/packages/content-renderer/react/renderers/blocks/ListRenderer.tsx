import React from "react";
import { renderBlockChildren } from "../../utils";

export function ListRenderer({ node, context }) {
  const Tag = node.ordered ? "ol" : "ul";
  const hasCheckboxItems = node.items.some((item) => item.checked != null);
  return (
    <Tag
      className={hasCheckboxItems ? "cr-list cr-list--task" : "cr-list"}
      start={node.ordered ? node.start : undefined}
    >
      {node.items.map((item, index) => (
        <li
          key={`item-${index}`}
          className={
            item.checked != null
              ? "cr-list-item cr-list-item--task"
              : "cr-list-item"
          }
        >
          {item.checked != null ? (
            <input
              className="cr-list-checkbox"
              type="checkbox"
              checked={item.checked}
              readOnly
            />
          ) : null}
          <div className="cr-list-item-content">
            {renderBlockChildren(
              item.children,
              context,
              `${context.currentBlockPath}.items.${index}.children`,
            )}
          </div>
        </li>
      ))}
    </Tag>
  );
}
