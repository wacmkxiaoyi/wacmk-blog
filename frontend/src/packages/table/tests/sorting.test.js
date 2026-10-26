import { describe, expect, it } from "vitest";
import {
  getDefaultSortState,
  getNextSortState,
  resolveColumns,
} from "../core/index.ts";

describe("table sorting", () => {
  it("resolves the default sort column", () => {
    const sort = getDefaultSortState([
      { key: "title", title: "Title", canOrder: true, render: () => null },
      {
        key: "updatedAt",
        title: "Updated",
        canOrder: true,
        defaultOrder: true,
        render: () => null,
      },
    ]);

    expect(sort).toEqual({ key: "updatedAt", direction: "desc" });
  });

  it("toggles sort state for the same column", () => {
    expect(getNextSortState(undefined, "title")).toEqual({
      key: "title",
      direction: "asc",
    });
    expect(
      getNextSortState({ key: "title", direction: "asc" }, "title"),
    ).toEqual({ key: "title", direction: "desc" });
    expect(
      getNextSortState({ key: "title", direction: "desc" }, "title"),
    ).toEqual({ key: "title", direction: "asc" });
  });

  it("marks active sort display state on resolved columns", () => {
    const columns = resolveColumns(
      [
        { key: "title", title: "Title", canOrder: true, render: () => null },
        { key: "email", title: "Email", canOrder: true, render: () => null },
      ],
      { key: "email", direction: "asc" },
    );

    expect(columns[0].displayOrder).toBe("none");
    expect(columns[1].displayOrder).toBe("asc");
    expect(columns[1].isActiveSort).toBe(true);
  });
});
