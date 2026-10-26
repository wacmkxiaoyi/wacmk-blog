import { describe, expect, it, vi } from "vitest";
import {
  getHeadingElementById,
  scrollElementIntoViewWithOffset,
} from "../react/navigation/index.ts";

describe("content-renderer scoped anchors", () => {
  it("resolves duplicate canonical heading ids within the active root only", () => {
    const firstHeading = { id: "cr-first-shared-heading" };
    const secondHeading = { id: "cr-second-shared-heading" };
    const firstRoot = {
      querySelector: vi.fn((selector) =>
        selector === '[data-content-heading-id="shared-heading"]'
          ? firstHeading
          : null,
      ),
      contains: vi.fn((element) => element === firstHeading),
    };
    const secondRoot = {
      querySelector: vi.fn((selector) =>
        selector === '[data-content-heading-id="shared-heading"]'
          ? secondHeading
          : null,
      ),
      contains: vi.fn((element) => element === secondHeading),
    };

    expect(getHeadingElementById("shared-heading", firstRoot)).toBe(
      firstHeading,
    );
    expect(getHeadingElementById("shared-heading", secondRoot)).toBe(
      secondHeading,
    );
  });

  it("scrolls the resolved scoped heading element", () => {
    const scrollIntoView = vi.fn();
    const heading = { scrollIntoView };

    expect(
      scrollElementIntoViewWithOffset(heading, {
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      }),
    ).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
  });
});
