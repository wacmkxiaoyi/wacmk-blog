import type { ReactNode } from "react";
import type { ContextActionGroup } from "../../../../context-actions/index.ts";
import type {
  TableColumn,
  TableSortDirection,
  TableTranslate,
} from "../../../core/index.ts";

export type TableHighlightColumn = {
  key: string;
  backgroundColor?: string;
};

export type TableProps<Row> = {
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row, rowIndex: number) => string | number;
  stickyFirstColumn?: boolean;
  defaultViewportColumnKey?: string;
  defaultViewportBehavior?: ScrollBehavior;
  highlightColumns?: TableHighlightColumn[];
  loading?: boolean;
  error?: ReactNode;
  empty?: ReactNode;
  searchText?: string;
  onSearchTextChange?: (value: string) => void;
  onSearchEnter?: () => void;
  searchChildren?: ReactNode;
  searchPlaceholderText?: string;
  sortKey?: string;
  sortDirection?: TableSortDirection;
  onSortChange?: (key: string) => void;
  page?: number;
  pageSize?: number;
  total?: number;
  pageSizeOptions?: number[];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  translate?: TableTranslate;
  getRowContextActions?: (row: Row, rowIndex: number) => ContextActionGroup[];
  contextMenuZIndex?: number;
  className?: string;
};
