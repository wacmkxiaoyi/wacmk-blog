import { describe, expect, it } from "vitest";
import { getArticleTagPalette } from "./articleTagPalette";

describe("getArticleTagPalette", () => {
  it("uses the id as the stable palette source", () => {
    expect(getArticleTagPalette({ id: 1, name: "React" })).toEqual(
      getArticleTagPalette({ id: 1, name: "Renamed" }),
    );
  });

  it("falls back to the name when no id is available", () => {
    expect(getArticleTagPalette({ name: "React" })["--article-tag-rgb"]).toBe(
      "98, 192, 61",
    );
  });
});
