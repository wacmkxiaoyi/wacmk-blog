import type { ReactNode } from "react";

export type TableSortDirection = "asc" | "desc";

export type TableDisplayOrder = TableSortDirection | "none";

export type TableColumn<Row> = {
  key: string;
  title: ReactNode;
  width?: number | string;
  minWidth?: number | string;
  align?: "left" | "center" | "right";
  canOrder?: boolean;
  defaultOrder?: boolean;
  ellipsis?: boolean;
  wrap?: boolean;
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (row: Row, rowIndex: number) => ReactNode;
};

export type TableSortState = {
  key: string;
  direction: TableSortDirection;
};

export type TableFetchParams = {
  query: string;
  page: number;
  pageSize: number;
  sortKey?: string;
  sortDirection?: TableSortDirection;
};

export type TableFetchResult<Row> = {
  items: Row[];
  total: number;
};

export type TableTranslate = (key: string, fallback: string) => string;

export type TableLabels = {
  searchPlaceholder: string;
  searchButton: string;
  noData: string;
  loading: string;
  previous: string;
  next: string;
  go: string;
  jumpToPage: string;
  pageSize: string;
  pageStatus: string;
};

export type TablePaginationState = {
  page: number;
  pageSize: number;
  total: number;
};

export type TableResolvedColumn<Row> = TableColumn<Row> & {
  displayOrder: TableDisplayOrder;
  isSortable: boolean;
  isActiveSort: boolean;
};
