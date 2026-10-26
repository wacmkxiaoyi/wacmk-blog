import { describe, expect, it } from "vitest";
import {
  getConditionAction,
  getConditionKey,
  getConditionTone,
  isAccessDecision,
  normalizeAccessDecision,
} from "./accessDecision";

describe("resource access decisions", () => {
  it("requires an explicit aggregate decision and a condition list", () => {
    expect(isAccessDecision({ allGranted: true, conditions: [] })).toBe(true);
    expect(isAccessDecision({ allGranted: "true", conditions: [] })).toBe(
      false,
    );
    expect(isAccessDecision({ allGranted: false })).toBe(false);
    expect(isAccessDecision(null)).toBe(false);
  });

  it("normalizes stable condition ids without changing access state", () => {
    const decision = normalizeAccessDecision({
      allGranted: false,
      conditions: [
        { type: "encrypted", action: "password" },
        { id: "price", type: "money" },
      ],
    });
    expect(decision.allGranted).toBe(false);
    expect(decision.conditions).toEqual([
      { id: "encrypted-0", type: "encrypted", action: "password" },
      { id: "price", type: "money", action: "none" },
    ]);
  });

  it("creates distinct fallback ids for same-type conditions", () => {
    const decision = normalizeAccessDecision({
      allGranted: false,
      conditions: [{ type: "encrypted" }, { type: "encrypted" }],
    });
    expect(decision.conditions.map((condition) => condition.id)).toEqual([
      "encrypted-0",
      "encrypted-1",
    ]);
  });

  it("does not infer the aggregate result from individual condition statuses", () => {
    const denied = normalizeAccessDecision({
      allGranted: false,
      conditions: [{ type: "money", status: "granted" }],
    });
    const granted = normalizeAccessDecision({
      allGranted: true,
      conditions: [
        { type: "encrypted", status: "pending", action: "password" },
      ],
    });
    expect(denied.allGranted).toBe(false);
    expect(granted.allGranted).toBe(true);
  });

  it("preserves custom actions while keeping unsupported actions safe", () => {
    expect(getConditionKey({ id: 7 }, 0)).toBe("7");
    expect(getConditionAction({ action: "license" })).toBe("license");
    expect(getConditionTone({ status: "granted", action: "purchase" })).toBe(
      "granted",
    );
    expect(getConditionTone({ status: "pending", action: "license" })).toBe(
      "blocked",
    );
    expect(getConditionTone({ status: "pending", action: "none" })).toBe(
      "blocked",
    );
  });
});
