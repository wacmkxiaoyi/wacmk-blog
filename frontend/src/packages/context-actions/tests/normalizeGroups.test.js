import { describe, expect, it } from "vitest";
import { normalizeContextActionGroups } from "../core/index.ts";

describe("context-actions group normalization", () => {
  it("sorts groups and merges repeated group ids", () => {
    const groups = normalizeContextActionGroups([
      {
        group: 2,
        children: [{ key: "delete", label: "Delete", onClick: () => {} }],
      },
      {
        group: 1,
        children: [{ key: "edit", label: "Edit", onClick: () => {} }],
      },
      {
        group: 2,
        children: [{ key: "browse", label: "Browse", onClick: () => {} }],
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].group).toBe(1);
    expect(groups[0].children.map((item) => item.key)).toEqual(["edit"]);
    expect(groups[1].group).toBe(2);
    expect(groups[1].children.map((item) => item.key)).toEqual([
      "delete",
      "browse",
    ]);
  });

  it("filters hidden children and drops empty groups", () => {
    const groups = normalizeContextActionGroups([
      {
        group: 1,
        children: [
          { key: "hidden", label: "Hidden", hidden: true, onClick: () => {} },
        ],
      },
      {
        group: 2,
        children: [
          { key: "visible", label: "Visible", onClick: () => {} },
          {
            key: "hidden-2",
            label: "Hidden 2",
            hidden: true,
            onClick: () => {},
          },
        ],
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].group).toBe(2);
    expect(groups[0].children.map((item) => item.key)).toEqual(["visible"]);
  });
});
