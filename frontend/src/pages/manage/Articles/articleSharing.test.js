import { describe, expect, it } from "vitest";
import { canShareArticle } from "./articleSharing";

describe("canShareArticle", () => {
  it("only allows public published articles from the published tab", () => {
    expect(
      canShareArticle("published", { kind: "published", visibility: "public" }),
    ).toBe(true);
    expect(
      canShareArticle("published", {
        kind: "published",
        visibility: "private",
      }),
    ).toBe(false);
    expect(
      canShareArticle("drafts", { kind: "published", visibility: "public" }),
    ).toBe(false);
    expect(
      canShareArticle("published", { kind: "revision", visibility: "public" }),
    ).toBe(false);
  });
});
