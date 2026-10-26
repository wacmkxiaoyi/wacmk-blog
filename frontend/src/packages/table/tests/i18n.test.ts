import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRANSLATIONS_TABLE,
  resolveTableLabel,
} from "../core/index.ts";

describe("table i18n", () => {
  it("uses built-in English translations when no translator is provided", () => {
    expect(resolveTableLabel(undefined, "table.searchButton", "Fallback")).toBe(
      "Search",
    );
    expect(resolveTableLabel(undefined, "table.unknown", "Fallback")).toBe(
      "Fallback",
    );
    expect(DEFAULT_TRANSLATIONS_TABLE["table.pagination.pageStatus"]).toBe(
      "Page: {current} / {total}",
    );
  });

  it("delegates labels to the provided translator", () => {
    const translate = (key: string, fallback: string) => `${key}: ${fallback}`;

    expect(resolveTableLabel(translate, "table.pagination.next", "Next")).toBe(
      "table.pagination.next: Next",
    );
  });
});
