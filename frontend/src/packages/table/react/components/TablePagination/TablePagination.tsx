import React, { useEffect, useMemo, useState } from "react";
import { clampPage, getTotalPages } from "../../../core/index.ts";
import styles from "./TablePagination.module.css";
import type { TablePaginationProps } from "./TablePagination.types.ts";

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

function formatLabel(
  template: string,
  values: Record<string, string | number>,
) {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    String(values[key] ?? `{${key}}`),
  );
}

export function TablePagination({
  page,
  pageSize,
  total,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
  labels,
}: TablePaginationProps) {
  const totalPages = useMemo(
    () => getTotalPages(total, pageSize),
    [pageSize, total],
  );
  const [jumpValue, setJumpValue] = useState(String(page));

  useEffect(() => {
    setJumpValue(String(page));
  }, [page]);

  return (
    <div className={styles.root}>
      <div className={styles.status}>
        {formatLabel(labels.pageStatus, { current: page, total: totalPages })}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={joinClassNames(
            styles.button,
            page <= 1 ? styles.buttonDisabled : "",
          )}
          onClick={() => onPageChange(clampPage(page - 1, total, pageSize))}
        >
          {labels.previous}
        </button>

        <button
          type="button"
          className={joinClassNames(
            styles.button,
            page >= totalPages ? styles.buttonDisabled : "",
          )}
          onClick={() => onPageChange(clampPage(page + 1, total, pageSize))}
        >
          {labels.next}
        </button>

        {typeof onPageSizeChange === "function" ? (
          <label className={styles.label}>
            {labels.pageSize}
            <select
              className={styles.select}
              value={String(pageSize)}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <form
          className={styles.jumpForm}
          onSubmit={(event) => {
            event.preventDefault();
            const nextPage = clampPage(Number(jumpValue), total, pageSize);
            setJumpValue(String(nextPage));
            onPageChange(nextPage);
          }}
        >
          <label className="sr-only" htmlFor="table-pagination-jump">
            {labels.jumpToPage}
          </label>
          <input
            id="table-pagination-jump"
            className={styles.input}
            type="number"
            min="1"
            max={String(totalPages)}
            value={jumpValue}
            aria-label={labels.jumpToPage}
            onChange={(event) => setJumpValue(event.target.value)}
          />
          <button type="submit" className={styles.button}>
            {labels.go}
          </button>
        </form>
      </div>
    </div>
  );
}
