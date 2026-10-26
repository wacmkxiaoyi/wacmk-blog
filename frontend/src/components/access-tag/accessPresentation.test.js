import { describe, expect, it } from "vitest";
import {
  getAccessPresentation,
  getValidConditions,
} from "./accessPresentation";

describe("access presentation", () => {
  it("maps public and private visibility to their presentations", () => {
    expect(getAccessPresentation("public")).toMatchObject({
      kind: "visibility",
      tone: "public",
      icon: "users",
    });
    expect(getAccessPresentation("private")).toMatchObject({
      kind: "visibility",
      tone: "private",
      icon: "user",
    });
  });

  it("keeps valid unique conditions and removes malformed or duplicate rules", () => {
    expect(
      getValidConditions([
        { type: "money", value: 12 },
        { type: "money", value: 25 },
        { type: "encrypted" },
        { type: "points", value: 0 },
      ]),
    ).toEqual([
      expect.objectContaining({ type: "money", value: 12 }),
      expect.objectContaining({ type: "encrypted" }),
    ]);
  });

  it("only resolves a conditional presentation when exactly one valid rule remains", () => {
    expect(
      getAccessPresentation("conditional", [{ type: "book_only" }]),
    ).toMatchObject({ kind: "condition", tone: "book-only" });
    expect(
      getAccessPresentation("conditional", [
        { type: "money", value: 2 },
        { type: "encrypted" },
      ]),
    ).toBeNull();
  });
});
