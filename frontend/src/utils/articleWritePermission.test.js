import { describe, expect, it } from "vitest";

import { getArticleWritePermission } from "./articleWritePermission";

describe("getArticleWritePermission", () => {
  const enabled = {
    "content.article": { allow_non_admin_create: true, vip_only: false },
  };

  it("always allows site managers", () => {
    expect(
      getArticleWritePermission(
        { is_staff: true },
        {
          "content.article": { allow_non_admin_create: false, vip_only: true },
        },
      ),
    ).toEqual({ allowed: true, reason: null });
  });

  it("reports configured non-administrator restrictions", () => {
    expect(
      getArticleWritePermission(
        { vip_level: 0 },
        { "content.article": { allow_non_admin_create: false } },
      ),
    ).toEqual({ allowed: false, reason: "disabled" });
    expect(
      getArticleWritePermission(
        { vip_level: 0 },
        { "content.article": { allow_non_admin_create: true, vip_only: true } },
      ),
    ).toEqual({ allowed: false, reason: "vipOnly" });
    expect(
      getArticleWritePermission(
        { vip_level: 1 },
        { "content.article": { allow_non_admin_create: true, vip_only: true } },
      ),
    ).toEqual({ allowed: true, reason: null });
    expect(getArticleWritePermission({ vip_level: 0 }, enabled)).toEqual({
      allowed: true,
      reason: null,
    });
  });
});
