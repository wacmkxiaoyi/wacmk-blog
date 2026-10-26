import type { TableFetchParams, TableSortState } from "./types.ts";

type QueryStateInput = {
  query: string;
  page: number;
  pageSize: number;
  sort?: TableSortState;
};

export function buildFetchParams({
  query,
  page,
  pageSize,
  sort,
}: QueryStateInput): TableFetchParams {
  return {
    query,
    page,
    pageSize,
    sortKey: sort?.key,
    sortDirection: sort?.direction,
  };
}
