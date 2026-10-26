import { describe, expect, it } from "vitest";
import { getTooltipPosition } from "../core/index.ts";

describe("tooltip positioning", () => {
  it("positions above the anchor when top placement fits", () => {
    expect(
      getTooltipPosition({
        anchorRect: { left: 200, top: 220, width: 80, height: 40 },
        tooltipSize: { width: 180, height: 72 },
        viewportWidth: 1280,
        viewportHeight: 720,
        placement: "top",
        offset: 10,
      }),
    ).toEqual({ x: 150, y: 138, placement: "top" });
  });

  it("flips to bottom when top placement does not fit", () => {
    expect(
      getTooltipPosition({
        anchorRect: { left: 140, top: 30, width: 90, height: 30 },
        tooltipSize: { width: 180, height: 80 },
        viewportWidth: 1280,
        viewportHeight: 720,
        placement: "top",
        offset: 12,
      }),
    ).toEqual({ x: 95, y: 72, placement: "bottom" });
  });

  it("flips to top when bottom placement does not fit", () => {
    expect(
      getTooltipPosition({
        anchorRect: { left: 300, top: 640, width: 120, height: 36 },
        tooltipSize: { width: 200, height: 90 },
        viewportWidth: 1280,
        viewportHeight: 720,
        placement: "bottom",
        offset: 8,
      }),
    ).toEqual({ x: 260, y: 542, placement: "top" });
  });

  it("constrains horizontal position into the viewport", () => {
    expect(
      getTooltipPosition({
        anchorRect: { left: 18, top: 250, width: 24, height: 24 },
        tooltipSize: { width: 220, height: 80 },
        viewportWidth: 320,
        viewportHeight: 640,
        placement: "top",
        offset: 10,
      }),
    ).toEqual({ x: 12, y: 160, placement: "top" });
  });
});
