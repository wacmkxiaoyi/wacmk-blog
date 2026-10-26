import { describe, expect, it } from "vitest";
import { getHtmlFrameContentHeight } from "../react/utils/htmlFrameHeight.ts";

describe("HTML frame height", () => {
  it("uses rendered content bounds instead of an inflated iframe scroll height", () => {
    const height = getHtmlFrameContentHeight({
      body: {
        children: [
          {
            tagName: "SECTION",
            getBoundingClientRect: () => ({ bottom: 206 }) as DOMRect,
          },
        ],
        scrollHeight: 353,
        getBoundingClientRect: () => ({ top: 0 }) as DOMRect,
      },
      documentElement: { scrollHeight: 353 },
    });

    expect(height).toBe(206);
  });

  it("ignores style elements when measuring the content bounds", () => {
    const height = getHtmlFrameContentHeight({
      body: {
        children: [
          {
            tagName: "STYLE",
            getBoundingClientRect: () => ({ bottom: 353 }) as DOMRect,
          },
          {
            tagName: "SECTION",
            getBoundingClientRect: () => ({ bottom: 206 }) as DOMRect,
          },
        ],
        getBoundingClientRect: () => ({ top: 0 }) as DOMRect,
      },
    });

    expect(height).toBe(206);
  });
});
