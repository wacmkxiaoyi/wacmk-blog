import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRANSLATIONS_COMMENTS,
  resolveCommentLabel,
} from "../core/index.ts";

describe("comments i18n", () => {
  it("uses built-in English translations when no translator is provided", () => {
    expect(resolveCommentLabel(undefined, "comments.title", "Fallback")).toBe(
      "Comments",
    );
    expect(resolveCommentLabel(undefined, "comments.unknown", "Fallback")).toBe(
      "Fallback",
    );
    expect(DEFAULT_TRANSLATIONS_COMMENTS["comments.showReplies"]).toBe(
      "Show {count} replies",
    );
  });

  it("delegates labels to the provided translator", () => {
    const translate = (key: string, fallback: string) => `${key}: ${fallback}`;

    expect(resolveCommentLabel(translate, "comments.reply", "Reply")).toBe(
      "comments.reply: Reply",
    );
  });
});
