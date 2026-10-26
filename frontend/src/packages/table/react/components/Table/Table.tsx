import React, { useEffect, useMemo, useRef, useState } from "react";
import { useContextActionsMenu } from "../../../../context-actions/index.ts";
import {
  normalizeColumns,
  resolveColumns,
  toSortState,
} from "../../../core/index.ts";
import { resolveTableLabel } from "../../../core/index.ts";
import { TablePagination } from "../TablePagination/TablePagination.tsx";
import { TableToolbar } from "../TableToolbar/TableToolbar.tsx";
import styles from "./Table.module.css";
import type { TableProps } from "./Table.types.ts";
import "../../theme/variables.css";

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

function shouldAllowNativeContextMenu(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], [contenteditable=''], [data-allow-native-context-menu='true']",
    ),
  );
}

const TABLE_CELL_BG_ODD = { red: 255, green: 255, blue: 255, alpha: 0.96 };
const TABLE_CELL_BG_EVEN = { red: 243, green: 244, blue: 246, alpha: 0.96 };

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampAlpha(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function parseHexColor(color: string) {
  const normalized = color.trim().slice(1);
  if (![3, 4, 6, 8].includes(normalized.length)) {
    return null;
  }

  const expanded =
    normalized.length <= 4
      ? normalized
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : normalized;

  const hasAlpha = expanded.length === 8;
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  const alpha = hasAlpha ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;

  if ([red, green, blue, alpha].some((value) => Number.isNaN(value))) {
    return null;
  }

  return { red, green, blue, alpha };
}

function parseRgbColor(color: string) {
  const match = color.trim().match(/^rgba?\((.+)\)$/i);
  if (!match) {
    return null;
  }

  const parts = match[1].split(",").map((part) => part.trim());
  if (parts.length !== 3 && parts.length !== 4) {
    return null;
  }

  const [red, green, blue, alpha = "1"] = parts;
  const parsedRed = Number.parseFloat(red);
  const parsedGreen = Number.parseFloat(green);
  const parsedBlue = Number.parseFloat(blue);
  const parsedAlpha = Number.parseFloat(alpha);

  if (
    [parsedRed, parsedGreen, parsedBlue, parsedAlpha].some((value) =>
      Number.isNaN(value),
    )
  ) {
    return null;
  }

  return {
    red: parsedRed,
    green: parsedGreen,
    blue: parsedBlue,
    alpha: parsedAlpha,
  };
}

function parseColor(color?: string) {
  if (!color) {
    return null;
  }

  if (color.trim().startsWith("#")) {
    return parseHexColor(color);
  }

  return parseRgbColor(color);
}

function mixColors(color, background, backgroundWeight: number) {
  const colorWeight = 1 - backgroundWeight;
  return {
    red: clampChannel(
      color.red * colorWeight + background.red * backgroundWeight,
    ),
    green: clampChannel(
      color.green * colorWeight + background.green * backgroundWeight,
    ),
    blue: clampChannel(
      color.blue * colorWeight + background.blue * backgroundWeight,
    ),
    alpha: clampAlpha(
      color.alpha * colorWeight + background.alpha * backgroundWeight,
    ),
  };
}

function toRgbaString(color) {
  return `rgba(${clampChannel(color.red)}, ${clampChannel(color.green)}, ${clampChannel(color.blue)}, ${clampAlpha(color.alpha)})`;
}

function getHighlightColumnStyle(backgroundColor?: string) {
  if (!backgroundColor) {
    return undefined;
  }

  const parsedColor = parseColor(backgroundColor);
  if (!parsedColor) {
    return {
      "--table-column-highlight-head-bg": backgroundColor,
      "--table-column-highlight-odd-bg": backgroundColor,
      "--table-column-highlight-even-bg": backgroundColor,
    };
  }

  return {
    "--table-column-highlight-head-bg": toRgbaString(
      mixColors(parsedColor, TABLE_CELL_BG_ODD, 0.08),
    ),
    "--table-column-highlight-odd-bg": toRgbaString(
      mixColors(parsedColor, TABLE_CELL_BG_ODD, 0.02),
    ),
    "--table-column-highlight-even-bg": toRgbaString(
      mixColors(parsedColor, TABLE_CELL_BG_EVEN, 0.42),
    ),
  };
}

function getCellContent<Row>(column, row: Row, rowIndex: number) {
  const content = column.render(row, rowIndex);
  if (column.wrap) {
    return <div className={styles.wrap}>{content}</div>;
  }
  if (column.ellipsis) {
    return (
      <div className={styles.ellipsis}>
        <span className={styles.ellipsisInner}>{content}</span>
      </div>
    );
  }
  return content;
}

export function Table<Row>({
  columns,
  rows,
  rowKey,
  stickyFirstColumn = false,
  defaultViewportColumnKey,
  defaultViewportBehavior = "auto",
  highlightColumns = [],
  loading = false,
  error = null,
  empty = null,
  searchText,
  onSearchTextChange,
  onSearchEnter,
  searchChildren,
  searchPlaceholderText,
  sortKey,
  sortDirection,
  onSortChange,
  page = 1,
  pageSize = 20,
  total = 0,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
  translate,
  getRowContextActions,
  contextMenuZIndex,
  className,
}: TableProps<Row>) {
  const labels = {
    searchPlaceholder: resolveTableLabel(
      translate,
      "table.searchPlaceholder",
      "Search...",
    ),
    searchButton: resolveTableLabel(translate, "table.searchButton", "Search"),
    noData: resolveTableLabel(translate, "table.noData", "No data found."),
    loading: resolveTableLabel(translate, "table.loading", "Loading..."),
    previous: resolveTableLabel(
      translate,
      "table.pagination.previous",
      "Previous",
    ),
    next: resolveTableLabel(translate, "table.pagination.next", "Next"),
    go: resolveTableLabel(translate, "table.pagination.go", "Go"),
    jumpToPage: resolveTableLabel(
      translate,
      "table.pagination.jumpToPage",
      "Jump to page",
    ),
    pageSize: resolveTableLabel(translate, "table.pagination.pageSize", "Rows"),
    pageStatus: resolveTableLabel(
      translate,
      "table.pagination.pageStatus",
      "Page: {current} / {total}",
    ),
  };
  const normalizedColumns = useMemo(() => normalizeColumns(columns), [columns]);
  const resolvedColumns = useMemo(
    () =>
      resolveColumns(normalizedColumns, toSortState(sortKey, sortDirection)),
    [normalizedColumns, sortDirection, sortKey],
  );
  const highlightColumnMap = useMemo(() => {
    return new Map(
      highlightColumns
        .filter((item) => item && item.key)
        .map((item) => [item.key, item]),
    );
  }, [highlightColumns]);
  const { menu, toggleRightClick, closeRightClick, isOpen } =
    useContextActionsMenu({ zIndex: contextMenuZIndex });
  const [activeRowKey, setActiveRowKey] = useState<string | number | null>(
    null,
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const appliedViewportKeyRef = useRef<string | null>(null);
  const hasSearch =
    typeof onSearchTextChange === "function" ||
    typeof onSearchEnter === "function" ||
    Boolean(searchChildren);
  const hasPagination = typeof onPageChange === "function" && total > 0;
  const colSpan = Math.max(1, resolvedColumns.length);

  function closeContextMenu() {
    setActiveRowKey(null);
    closeRightClick();
  }

  const contentRow = loading
    ? { kind: "loading", content: labels.loading }
    : error
      ? { kind: "error", content: error }
      : rows.length === 0
        ? { kind: "empty", content: empty || labels.noData }
        : null;

  useEffect(() => {
    const scrollNode = scrollRef.current;
    if (
      !scrollNode ||
      !defaultViewportColumnKey ||
      contentRow ||
      appliedViewportKeyRef.current === defaultViewportColumnKey
    ) {
      return;
    }
    if (scrollNode.scrollWidth <= scrollNode.clientWidth) {
      return;
    }

    const targetHeaderCell = scrollNode.querySelector(
      `[data-table-column-key='${defaultViewportColumnKey}']`,
    ) as HTMLElement | null;
    if (!targetHeaderCell) {
      return;
    }

    const stickyHeaderCell = stickyFirstColumn
      ? (scrollNode.querySelector("thead th:first-child") as HTMLElement | null)
      : null;
    const stickyWidth = stickyHeaderCell
      ? stickyHeaderCell.getBoundingClientRect().width
      : 0;
    const targetOffsetLeft = targetHeaderCell.offsetLeft;
    const targetWidth = targetHeaderCell.getBoundingClientRect().width;
    const usableWidth = stickyFirstColumn
      ? Math.max(scrollNode.clientWidth - stickyWidth, 0)
      : scrollNode.clientWidth;
    const targetScrollLeft = stickyFirstColumn
      ? targetOffsetLeft - stickyWidth - (usableWidth - targetWidth) / 2
      : targetOffsetLeft - (usableWidth - targetWidth) / 2;

    scrollNode.scrollTo({
      left: Math.max(Math.round(targetScrollLeft), 0),
      behavior: defaultViewportBehavior,
    });
    appliedViewportKeyRef.current = defaultViewportColumnKey;
  }, [
    contentRow,
    defaultViewportBehavior,
    defaultViewportColumnKey,
    rows.length,
    stickyFirstColumn,
  ]);

  useEffect(() => {
    if (!defaultViewportColumnKey) {
      appliedViewportKeyRef.current = null;
    }
  }, [defaultViewportColumnKey]);

  return (
    <div className={joinClassNames(styles.root, className)}>
      {hasSearch ? (
        <TableToolbar
          searchText={searchText || ""}
          searchPlaceholderText={
            searchPlaceholderText || labels.searchPlaceholder
          }
          searchButtonLabel={labels.searchButton}
          onSearchTextChange={onSearchTextChange}
          onSearchEnter={onSearchEnter}
        >
          {searchChildren}
        </TableToolbar>
      ) : null}

      <div className={styles.surface}>
        <div ref={scrollRef} className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                {resolvedColumns.map((column) => {
                  const isStickyFirst =
                    stickyFirstColumn && column.key === resolvedColumns[0]?.key;
                  const highlightColumn = highlightColumnMap.get(column.key);
                  const alignClassName =
                    column.align === "center"
                      ? styles.alignCenter
                      : column.align === "right"
                        ? styles.alignRight
                        : "";

                  return (
                    <th
                      key={column.key}
                      className={joinClassNames(
                        styles.headCell,
                        alignClassName,
                        isStickyFirst ? styles.stickyFirstHeadCell : "",
                        highlightColumn ? styles.highlightHeadCell : "",
                        column.headerClassName,
                      )}
                      style={{
                        width: column.width,
                        minWidth: column.minWidth,
                        ...getHighlightColumnStyle(
                          highlightColumn?.backgroundColor,
                        ),
                      }}
                      scope="col"
                      data-table-column-key={column.key}
                    >
                      {column.isSortable ? (
                        <button
                          type="button"
                          className={joinClassNames(
                            styles.sortButton,
                            column.isActiveSort ? styles.sortButtonActive : "",
                          )}
                          onClick={() => onSortChange?.(column.key)}
                        >
                          <span>{column.title}</span>
                          <span
                            className={styles.sortIndicator}
                            aria-hidden="true"
                          >
                            {column.displayOrder === "asc"
                              ? "▲"
                              : column.displayOrder === "desc"
                                ? "▼"
                                : "△▽"}
                          </span>
                        </button>
                      ) : (
                        <span>{column.title}</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {contentRow ? (
                <tr className={styles.messageRow}>
                  <td className={styles.messageCell} colSpan={colSpan}>
                    {contentRow.content}
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => {
                  const currentRowKey = rowKey(row, rowIndex);
                  const actions = getRowContextActions
                    ? getRowContextActions(row, rowIndex)
                    : [];
                  const rowClassName = joinClassNames(
                    rowIndex % 2 === 0 ? styles.bodyRowOdd : styles.bodyRowEven,
                    styles.bodyRowHover,
                    activeRowKey === currentRowKey ? styles.bodyRowActive : "",
                  );

                  return (
                    <tr
                      key={String(currentRowKey)}
                      className={rowClassName}
                      onContextMenu={(event) => {
                        if (
                          !actions.length ||
                          shouldAllowNativeContextMenu(event.target)
                        ) {
                          return;
                        }
                        setActiveRowKey(currentRowKey);
                        toggleRightClick(event, actions);
                      }}
                      onClick={() => {
                        if (isOpen) {
                          closeContextMenu();
                        }
                      }}
                    >
                      {resolvedColumns.map((column) => {
                        const isStickyFirst =
                          stickyFirstColumn &&
                          column.key === resolvedColumns[0]?.key;
                        const highlightColumn = highlightColumnMap.get(
                          column.key,
                        );
                        const alignClassName =
                          column.align === "center"
                            ? styles.alignCenter
                            : column.align === "right"
                              ? styles.alignRight
                              : "";

                        return (
                          <td
                            key={column.key}
                            className={joinClassNames(
                              styles.cell,
                              alignClassName,
                              isStickyFirst ? styles.stickyFirstCell : "",
                              highlightColumn ? styles.highlightCell : "",
                              column.className,
                              column.cellClassName,
                            )}
                            style={{
                              width: column.width,
                              minWidth: column.minWidth,
                              ...getHighlightColumnStyle(
                                highlightColumn?.backgroundColor,
                              ),
                            }}
                          >
                            {getCellContent(column, row, rowIndex)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {hasPagination ? (
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          pageSizeOptions={pageSizeOptions}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          labels={labels}
        />
      ) : null}

      {React.cloneElement(menu as React.ReactElement, {
        onClose: closeContextMenu,
      })}
    </div>
  );
}
