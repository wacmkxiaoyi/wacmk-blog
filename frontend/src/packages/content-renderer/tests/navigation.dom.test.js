import { describe, expect, it } from "vitest";
import {
  buildScopedHeadingDomId,
  getHeadingElementById,
  parseAnchorHref,
} from "../react/navigation/index.ts";

describe("content-renderer navigation dom", () => {
  it("prefers scoped root querySelector when root is an element", () => {
    const expected = { id: "cr-preview-section-a" };
    const foreign = { id: "section-a" };
    const root = {
      querySelector: (selector) =>
        selector === '[data-content-heading-id="section-a"]' ? expected : null,
      contains: (element) => element === expected,
      ownerDocument: {
        getElementById: () => foreign,
      },
    };

    expect(getHeadingElementById("section-a", root)).toBe(expected);
  });

  it("escapes selector-safe heading ids for scoped lookup", () => {
    const selectors = [];
    const expected = { id: "section:a/1" };
    const root = {
      querySelector: (selector) => {
        selectors.push(selector);
        return expected;
      },
      ownerDocument: {
        getElementById: () => null,
      },
    };

    expect(getHeadingElementById("section:a/1", root)).toBe(expected);
    expect(selectors[0]).toContain("section");
    expect(selectors[0]).toContain(":a");
    expect(selectors[0]).toContain("/1");
  });

  it("builds instance-scoped dom ids from canonical heading ids", () => {
    expect(
      buildScopedHeadingDomId("multi-line-list-selection", "previewA"),
    ).toBe("cr-previewA-multi-line-list-selection");
  });

  it("parses anchor href values safely", () => {
    expect(parseAnchorHref("#multi-line-list-selection")).toBe(
      "multi-line-list-selection",
    );
    expect(
      parseAnchorHref("https://example.com#multi-line-list-selection"),
    ).toBe("");
    expect(parseAnchorHref("")).toBe("");
  });

  it("resolves generic content anchors for formula links", () => {
    const expected = { id: "equation-2" };
    const root = {
      querySelector: (selector) =>
        selector === '[data-content-anchor-id="equation-2"]' ? expected : null,
      contains: (element) => element === expected,
      ownerDocument: {
        getElementById: () => null,
      },
    };

    expect(getHeadingElementById("equation-2", root)).toBe(expected);
  });
});
