import { describe, expect, it } from "vitest";
import {
  bookStructureToCatalog,
  catalogToBookStructure,
} from "./bookStructure";

describe("book structure conversion", () => {
  it("converts persisted article and group nodes into catalog-manager data", () => {
    const catalog = bookStructureToCatalog(
      [
        {
          type: "group",
          title: "Part one",
          children: [{ type: "article", article_id: 7 }],
        },
      ],
      [
        {
          id: 7,
          title: "Introduction",
          visibility: "conditional",
          condition_rules: [{ type: "money", value: 20 }],
          access_scope: "standalone",
          vip_access_permission: "private",
          vip_condition_rules: [],
        },
      ],
    );

    expect(catalog).toMatchObject([
      {
        _kind: "catalog-group",
        title: "Part one",
        children: [
          {
            id: 7,
            title: "Introduction",
            visibility: "conditional",
            condition_rules: [{ type: "money", value: 20 }],
            access_scope: "standalone",
            vip_access_permission: "private",
            vip_condition_rules: [],
          },
        ],
      },
    ]);
  });

  it("serializes catalog-manager data without editor keys or duplicate articles", () => {
    expect(
      catalogToBookStructure([
        {
          _kind: "catalog-group",
          _key: "group-1",
          title: " Part one ",
          children: [{ id: 7, title: "Introduction" }],
        },
        { id: 7, title: "Duplicate" },
      ]),
    ).toEqual([
      {
        type: "group",
        title: "Part one",
        children: [{ type: "article", article_id: 7 }],
      },
    ]);
  });
});
