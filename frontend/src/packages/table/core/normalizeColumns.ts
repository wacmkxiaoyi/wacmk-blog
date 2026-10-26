import type { TableColumn } from "./types.ts";

export function normalizeColumns<Row>(
  columns: TableColumn<Row>[] = [],
): TableColumn<Row>[] {
  return columns.filter((column) =>
    Boolean(column && column.key && typeof column.render === "function"),
  );
}
