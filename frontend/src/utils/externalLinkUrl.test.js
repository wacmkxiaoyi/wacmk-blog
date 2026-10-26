import { describe, expect, it } from "vitest";
import { externalLinkUrl } from "./externalLinkUrl";

describe("externalLinkUrl", () => {
  it("resolves a relative shared-link path against the current frontend origin", () => {
    expect(
      externalLinkUrl(
        "/external-link/articles/token",
        "https://blog.example.com",
      ),
    ).toBe("https://blog.example.com/external-link/articles/token");
  });

  it("returns an empty string when no shared link is available", () => {
    expect(externalLinkUrl(null)).toBe("");
  });
});
