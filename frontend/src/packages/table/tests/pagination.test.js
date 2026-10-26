import { describe, expect, it } from "vitest";
import { clampPage, getTotalPages } from "../core/index.ts";

describe("table pagination", () => {
  it("calculates total pages with a minimum of one", () => {
    expect(getTotalPages(0, 20)).toBe(1);
    expect(getTotalPages(45, 20)).toBe(3);
  });

  it("clamps invalid pages into range", () => {
    expect(clampPage(0, 45, 20)).toBe(1);
    expect(clampPage(5, 45, 20)).toBe(3);
    expect(clampPage(2, 45, 20)).toBe(2);
  });
});
