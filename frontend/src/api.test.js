import { describe, expect, it } from "vitest";
import { normalizeResourceAccessDecision } from "./api";

describe("resource access response normalization", () => {
  it("maps the resource_access snake-case decision without dropping the effective channel", () => {
    expect(
      normalizeResourceAccessDecision({
        resource_type: "book",
        resource_id: 12,
        label: "VIP book",
        access_scope: "standalone",
        effective_channel: "vip",
        is_vip: true,
        all_granted: false,
        conditions: [
          {
            type: "money",
            original_requirement: 50,
            discounted_requirement: 40,
            discount_rate: "0.2",
            discount_applied: true,
            status: "purchase_required",
            action: "purchase",
          },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        resourceType: "book",
        resourceId: 12,
        accessScope: "standalone",
        effectiveChannel: "vip",
        isVip: true,
        allGranted: false,
        conditions: [
          expect.objectContaining({
            originalRequirement: 50,
            discountedRequirement: 40,
            discountRate: "0.2",
            discountPercent: 20,
            discountApplied: true,
          }),
        ],
      }),
    );
  });

  it("rejects incomplete decisions rather than allowing a partial response", () => {
    expect(normalizeResourceAccessDecision({ all_granted: true })).toBeNull();
    expect(
      normalizeResourceAccessDecision({ all_granted: "true", conditions: [] }),
    ).toBeNull();
  });
});
