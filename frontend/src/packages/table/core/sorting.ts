import type {
  TableColumn,
  TableDisplayOrder,
  TableResolvedColumn,
  TableSortDirection,
  TableSortState,
} from "./types.ts";

export function getDefaultSortState<Row>(
  columns: TableColumn<Row>[] = [],
): TableSortState | undefined {
  const column = columns.find(
    (item) => item && item.canOrder && item.defaultOrder,
  );
  if (!column) {
    return undefined;
  }
  return {
    key: column.key,
    direction: "desc",
  };
}

export function getNextSortState(
  current: TableSortState | undefined,
  key: string,
): TableSortState {
  if (!current || current.key !== key) {
    return { key, direction: "asc" };
  }

  return {
    key,
    direction: current.direction === "asc" ? "desc" : "asc",
  };
}

export function getColumnDisplayOrder<Row>(
  column: TableColumn<Row>,
  current: TableSortState | undefined,
): TableDisplayOrder {
  if (!column.canOrder) {
    return "none";
  }
  if (!current || current.key !== column.key) {
    return "none";
  }
  return current.direction;
}

export function resolveColumns<Row>(
  columns: TableColumn<Row>[] = [],
  current: TableSortState | undefined,
): TableResolvedColumn<Row>[] {
  return columns.map((column) => {
    const displayOrder = getColumnDisplayOrder(column, current);
    return {
      ...column,
      displayOrder,
      isSortable: Boolean(column.canOrder),
      isActiveSort: displayOrder !== "none",
    };
  });
}

export function isSortableColumn<Row>(
  columns: TableColumn<Row>[] = [],
  key: string,
): boolean {
  return columns.some(
    (column) => column && column.key === key && column.canOrder,
  );
}

export function toSortState(
  key?: string,
  direction?: TableSortDirection,
): TableSortState | undefined {
  if (!key || !direction) {
    return undefined;
  }
  return { key, direction };
}
