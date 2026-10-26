import React from "react";
import { renderBlockChildren } from "../../utils";

function renderCell(cell, context, key) {
  const Tag = cell.header ? "th" : "td";
  return (
    <Tag key={key} align={cell.align || undefined}>
      {renderBlockChildren(
        cell.children,
        context,
        `${context.currentBlockPath}.${key}.children`,
      )}
    </Tag>
  );
}

export function TableRenderer({ node, context }) {
  const maxTableRows = Number(context.options.maxTableRows || 6);
  const collapsible =
    context.options.enableTableOverflow !== false &&
    node.body.length > maxTableRows;
  const [expanded, setExpanded] = React.useState(!collapsible);

  React.useEffect(() => {
    setExpanded(!collapsible);
  }, [collapsible, node.body.length]);

  const hiddenCount = Math.max(0, node.body.length - maxTableRows);

  return (
    <div className="cr-table-wrap">
      <div className="cr-table-scroll">
        <div
          className={
            collapsible && !expanded
              ? "cr-table-overflow is-collapsed"
              : "cr-table-overflow"
          }
          style={
            collapsible && !expanded
              ? { "--table-visible-rows": maxTableRows }
              : undefined
          }
        >
          <table className="cr-table">
            {node.head ? (
              <thead>
                <tr>
                  {node.head.cells.map((cell, index) =>
                    renderCell(
                      { ...cell, align: node.align?.[index] ?? cell.align },
                      context,
                      `head-${index}`,
                    ),
                  )}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {node.body.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {row.cells.map((cell, cellIndex) =>
                    renderCell(
                      { ...cell, align: node.align?.[cellIndex] ?? cell.align },
                      context,
                      `cell-${rowIndex}-${cellIndex}`,
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {collapsible && !expanded ? (
            <div className="cr-overflow-overlay">
              <div className="cr-overflow-hint">
                Hidden {hiddenCount} more lines
              </div>
              <button
                type="button"
                className="cr-overflow-button cr-table-overflow-button"
                onClick={() => setExpanded(true)}
              >
                {context.labels.expand}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
