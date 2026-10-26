import { describe, expect, it } from "vitest";
import { getProfileSection } from "./profileSections";

describe("getProfileSection", () => {
  it("keeps enabled non-article sections from the URL", () => {
    expect(getProfileSection("moneyHistory")).toBe("moneyHistory");
    expect(getProfileSection("pointsHistory")).toBe("pointsHistory");
    expect(getProfileSection("attachments")).toBe("attachments");
  });

  it("keeps the enabled books section and falls back for unknown sections", () => {
    expect(getProfileSection(null)).toBe("basic");
    expect(getProfileSection("books")).toBe("books");
    expect(getProfileSection("unknown")).toBe("basic");
  });
});
