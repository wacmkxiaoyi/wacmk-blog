import { describe, expect, it } from "vitest";
import { getBookWritePermission } from "./bookWritePermission";

const config = {
  "content.book": {
    allow_non_admin_create: true,
    vip_only: false,
    non_admin_max_count: 2,
  },
};

describe("getBookWritePermission", () => {
  it("applies the strict current book quota to editing and creation entry points", () => {
    expect(getBookWritePermission({ vip_level: 0 }, config, 2)).toEqual({
      allowed: false,
      reason: "limitReached",
    });
    expect(getBookWritePermission({ vip_level: 0 }, config, 1)).toEqual({
      allowed: true,
      reason: null,
    });
  });

  it("always permits site managers", () => {
    expect(
      getBookWritePermission(
        { is_staff: true },
        { "content.book": { allow_non_admin_create: false } },
        99,
      ),
    ).toEqual({ allowed: true, reason: null });
  });
});
