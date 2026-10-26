import React from "react";
import styles from "./TableToolbar.module.css";
import type { TableToolbarProps } from "./TableToolbar.types.ts";

export function TableToolbar({
  searchText,
  searchPlaceholderText,
  searchButtonLabel,
  onSearchTextChange,
  onSearchEnter,
  children,
}: TableToolbarProps) {
  return (
    <div className={styles.root}>
      <div className={styles.search}>
        <input
          type="search"
          className={styles.input}
          value={searchText}
          placeholder={searchPlaceholderText}
          aria-label={searchPlaceholderText}
          onChange={(event) => onSearchTextChange?.(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSearchEnter?.();
            }
          }}
        />
        <button
          type="button"
          className={styles.button}
          onClick={() => onSearchEnter?.()}
        >
          {searchButtonLabel}
        </button>
      </div>
      {children ? <div className={styles.extras}>{children}</div> : null}
    </div>
  );
}
