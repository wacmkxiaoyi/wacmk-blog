import type { ReactNode } from "react";

export type TableToolbarProps = {
  searchText: string;
  searchPlaceholderText: string;
  searchButtonLabel: string;
  onSearchTextChange?: (value: string) => void;
  onSearchEnter?: () => void;
  children?: ReactNode;
};
