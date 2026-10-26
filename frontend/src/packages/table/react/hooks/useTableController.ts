import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildFetchParams,
  clampPage,
  getDefaultSortState,
  getNextSortState,
  isSortableColumn,
} from "../../core/index.ts";
import type {
  TableColumn,
  TableFetchResult,
  TableSortDirection,
  TableSortState,
} from "../../core/index.ts";

export type UseTableControllerOptions<Row> = {
  columns?: TableColumn<Row>[];
  fetchData: (
    params: {
      query: string;
      page: number;
      pageSize: number;
      sortKey?: string;
      sortDirection?: TableSortDirection;
    },
    config?: { signal?: AbortSignal },
  ) => Promise<TableFetchResult<Row>>;
  initialQuery?: string;
  initialPage?: number;
  initialPageSize?: number;
  initialSort?: TableSortState;
};

export type UseTableControllerResult<Row> = {
  rows: Row[];
  loading: boolean;
  error: unknown;
  searchText: string;
  query: string;
  page: number;
  pageSize: number;
  total: number;
  sortKey?: string;
  sortDirection?: TableSortDirection;
  setSearchText: (value: string) => void;
  submitSearch: () => void;
  changeSort: (key: string) => void;
  changePage: (page: number) => void;
  changePageSize: (pageSize: number) => void;
  replaceRow: (matches: (row: Row) => boolean, replacement: Row) => void;
  removeRow: (matches: (row: Row) => boolean) => void;
  refresh: () => Promise<void>;
};

export function useTableController<Row>({
  columns = [],
  fetchData,
  initialQuery = "",
  initialPage = 1,
  initialPageSize = 20,
  initialSort,
}: UseTableControllerOptions<Row>): UseTableControllerResult<Row> {
  const defaultSort = useMemo(
    () => initialSort || getDefaultSortState(columns),
    [columns, initialSort],
  );
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [searchText, setSearchText] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<TableSortState | undefined>(defaultSort);
  const requestIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const runFetch = useCallback(
    async (nextState?: {
      query?: string;
      page?: number;
      pageSize?: number;
      sort?: TableSortState;
    }) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      const effectiveQuery = nextState?.query ?? query;
      const effectivePage = nextState?.page ?? page;
      const effectivePageSize = nextState?.pageSize ?? pageSize;
      const effectiveSort = nextState?.sort ?? sort;

      setLoading(true);
      setError(null);

      try {
        const result = await fetchData(
          buildFetchParams({
            query: effectiveQuery,
            page: effectivePage,
            pageSize: effectivePageSize,
            sort: effectiveSort,
          }),
          { signal: controller.signal },
        );

        if (requestId !== requestIdRef.current || controller.signal.aborted) {
          return;
        }

        setRows(Array.isArray(result?.items) ? result.items : []);
        setTotal(
          typeof result?.total === "number" ? Math.max(0, result.total) : 0,
        );

        const safePage = clampPage(
          effectivePage,
          typeof result?.total === "number" ? result.total : 0,
          effectivePageSize,
        );
        if (safePage !== effectivePage) {
          setPage(safePage);
        }
      } catch (nextError) {
        if (requestId !== requestIdRef.current || controller.signal.aborted) {
          return;
        }
        setError(nextError);
        setRows([]);
        setTotal(0);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          controllerRef.current = null;
        }
      }
    },
    [fetchData, page, pageSize, query, sort],
  );

  useEffect(() => {
    void runFetch();
    // The controller explicitly triggers later fetches from its own event handlers.
    // This avoids duplicate requests after every state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => controllerRef.current?.abort();
  }, []);

  const submitSearch = useCallback(() => {
    const nextPage = 1;
    setQuery(searchText);
    setPage(nextPage);
    void runFetch({ query: searchText, page: nextPage });
  }, [runFetch, searchText]);

  const changeSort = useCallback(
    (key: string) => {
      if (columns.length > 0 && !isSortableColumn(columns, key)) {
        return;
      }
      const nextSort = getNextSortState(sort, key);
      const nextPage = 1;
      setSort(nextSort);
      setPage(nextPage);
      void runFetch({ sort: nextSort, page: nextPage });
    },
    [columns, runFetch, sort],
  );

  const changePage = useCallback(
    (nextPage: number) => {
      setPage(nextPage);
      void runFetch({ page: nextPage });
    },
    [runFetch],
  );

  const changePageSize = useCallback(
    (nextPageSize: number) => {
      const safePageSize = Math.max(1, Math.trunc(nextPageSize));
      const nextPage = 1;
      setPageSize(safePageSize);
      setPage(nextPage);
      void runFetch({ pageSize: safePageSize, page: nextPage });
    },
    [runFetch],
  );

  const refresh = useCallback(async () => {
    await runFetch();
  }, [runFetch]);

  const replaceRow = useCallback(
    (matches: (row: Row) => boolean, replacement: Row) => {
      setRows((currentRows) =>
        currentRows.map((row) => (matches(row) ? replacement : row)),
      );
    },
  );

  const removeRow = useCallback((matches: (row: Row) => boolean) => {
    setRows((currentRows) => {
      const nextRows = currentRows.filter((row) => !matches(row));
      if (nextRows.length === currentRows.length) return currentRows;
      setTotal((currentTotal) => Math.max(0, currentTotal - 1));
      return nextRows;
    });
  }, []);

  return {
    rows,
    loading,
    error,
    searchText,
    query,
    page,
    pageSize,
    total,
    sortKey: sort?.key,
    sortDirection: sort?.direction,
    setSearchText,
    submitSearch,
    changeSort,
    changePage,
    changePageSize,
    replaceRow,
    removeRow,
    refresh,
  };
}
