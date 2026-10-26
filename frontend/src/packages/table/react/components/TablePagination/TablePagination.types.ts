import type { TableLabels } from "../../../core/index.ts";

export type TablePaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  labels: TableLabels;
};
