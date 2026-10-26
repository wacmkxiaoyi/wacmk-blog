import { describe, expect, it } from "vitest";
import { formatContentQuota, getContentQuota } from "./contentQuota";

describe("content quotas", () => {
  it("represents disabled publishing as zero and an unlimited setting as infinity", () => {
    expect(
      getContentQuota(
        {},
        { allow_non_admin_create: false, non_admin_max_count: 3 },
      ),
    ).toBe(0);
    expect(
      formatContentQuota(
        getContentQuota(
          {},
          { allow_non_admin_create: true, non_admin_max_count: 0 },
        ),
      ),
    ).toBe("∞");
  });

  it("does not limit administrators", () => {
    expect(
      formatContentQuota(
        getContentQuota({ is_staff: true }, { allow_non_admin_create: false }),
      ),
    ).toBe("∞");
  });
});
