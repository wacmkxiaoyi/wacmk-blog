import { describe, expect, it } from "vitest";
import { buildFetchParams } from "../core/index.ts";

describe("table query state", () => {
  it("builds fetch params from query state", () => {
    expect(
      buildFetchParams({
        query: "abc",
        page: 2,
        pageSize: 50,
        sort: { key: "updatedAt", direction: "desc" },
      }),
    ).toEqual({
      query: "abc",
      page: 2,
      pageSize: 50,
      sortKey: "updatedAt",
      sortDirection: "desc",
    });
  });

  it("omits missing sort state", () => {
    expect(
      buildFetchParams({
        query: "",
        page: 1,
        pageSize: 20,
      }),
    ).toEqual({
      query: "",
      page: 1,
      pageSize: 20,
      sortKey: undefined,
      sortDirection: undefined,
    });
  });
});
