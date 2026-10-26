# table

`table` is a reusable React table package for WACMK-style management lists.

## Goals

- Keep business concepts outside the package
- Preserve the old management table interaction style
- Support search, sorting, pagination, and row context actions
- Stay publishable and easy to reuse across projects

## Recommended usage

```tsx
import { Table, useTableController } from "../table";

function Example() {
  const table = useTableController({
    initialPageSize: 20,
    initialSort: { key: "createdAt", direction: "desc" },
    fetchData: async ({ query, page, pageSize, sortKey, sortDirection }) => {
      return {
        items: [],
        total: 0,
      };
    },
  });

  return (
    <Table
      columns={[]}
      rows={table.rows}
      rowKey={(row) => row.id}
      loading={table.loading}
      searchText={table.searchText}
      onSearchTextChange={table.setSearchText}
      onSearchEnter={table.submitSearch}
      searchPlaceholderText="Search..."
      sortKey={table.sortKey}
      sortDirection={table.sortDirection}
      onSortChange={table.changeSort}
      page={table.page}
      pageSize={table.pageSize}
      total={table.total}
      onPageChange={table.changePage}
      onPageSizeChange={table.changePageSize}
    />
  );
}
```

## Package shape

- `Table`: presentational component for rendering rows, headers, search, pagination, and row context actions
- `useTableController`: optional controller hook for server-driven search, sorting, and pagination

## Notes

- The package does not know about routes, pages, tabs, or business concepts
- Long rows use horizontal scrolling by default to match the old management UI pattern
- Context menu rendering is powered by the existing `context-actions` package
