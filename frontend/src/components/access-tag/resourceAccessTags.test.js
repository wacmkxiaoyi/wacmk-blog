import { describe, expect, it } from "vitest";
import { getResourceAccessChannels } from "./resourceAccessTags";

describe("resource access tags", () => {
  it("uses one common channel for unified access", () => {
    expect(
      getResourceAccessChannels({
        visibility: "private",
        access_scope: "unified",
      }),
    ).toEqual([{ type: "private", value: undefined, isVIP: false }]);
  });

  it("uses common and VIP channels for standalone access", () => {
    expect(
      getResourceAccessChannels({
        visibility: "conditional",
        condition_rules: [{ type: "points", value: 20 }],
        access_scope: "standalone",
        vip_access_permission: "conditional",
        vip_condition_rules: [
          { type: "money", value: 10 },
          { type: "encrypted" },
        ],
      }),
    ).toEqual([
      {
        type: "conditional",
        value: [{ type: "points", value: 20 }],
        isVIP: false,
      },
      {
        type: "conditional",
        value: [{ type: "money", value: 10 }, { type: "encrypted" }],
        isVIP: true,
      },
    ]);
  });

  it("omits conditional channels when their rules are invalid or missing", () => {
    expect(
      getResourceAccessChannels({
        visibility: "conditional",
        condition_rules: [{ type: "points", value: 0 }],
        access_scope: "standalone",
        vip_access_permission: "private",
        vip_condition_rules: [{ type: "unknown" }],
      }),
    ).toEqual([{ type: "private", value: undefined, isVIP: true }]);

    expect(
      getResourceAccessChannels({
        visibility: "conditional",
        access_scope: "unified",
      }),
    ).toEqual([]);
  });

  it("ignores stale conditions when a channel is no longer conditional", () => {
    expect(
      getResourceAccessChannels({
        visibility: "private",
        condition_rules: [{ type: "points", value: 20 }],
        access_scope: "standalone",
        vip_access_permission: "public",
        vip_condition_rules: [{ type: "money", value: 10 }],
      }),
    ).toEqual([
      { type: "private", value: undefined, isVIP: false },
      { type: "public", value: undefined, isVIP: true },
    ]);
  });
});
