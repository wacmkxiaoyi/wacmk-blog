import { describe, expect, it } from "vitest";
import {
  getAttachmentAccessDecision,
  getInternalContentPath,
  InvalidAttachmentBlock,
  normalizeArticleMarkdown,
} from "../articleContentTemplate";

describe("article content renderer template", () => {
  it("preserves the custom attachment block protocol", () => {
    const value =
      '::custom{kind="attachment" assetId="11111111-1111-4111-8111-111111111111" title="Archive"}';
    expect(normalizeArticleMarkdown(value)).toBe(value);
  });

  it("only treats article and book routes as internal content links", () => {
    expect(getInternalContentPath("/articles/rendering-basics/")).toBe(
      "/articles/rendering-basics/",
    );
    expect(getInternalContentPath("/books/content-design/")).toBe(
      "/books/content-design/",
    );
    expect(
      getInternalContentPath("https://example.com/articles/test"),
    ).toBeNull();
  });

  it("normalizes manifest access decisions for attachment authorization", () => {
    const decision = getAttachmentAccessDecision({
      attachmentId: 9,
      accessDecision: {
        all_granted: true,
        can_finalize: false,
        settlement_required: false,
        conditions: [],
      },
    });
    expect(decision).toMatchObject({
      allGranted: true,
      canFinalize: false,
      settlementRequired: false,
      conditions: [],
    });
  });

  it("renders a clear placeholder for an unavailable attachment", () => {
    const block = InvalidAttachmentBlock({
      title: "NDP46-KB3045557-x86-x64-AllOS-ENU.exe.qdl",
      label: "Attachment unavailable",
      description:
        "This attachment has been deleted and can no longer be downloaded.",
    });
    expect(block.props.className).toBe(
      "content-attachment content-attachment--missing",
    );
    expect(
      block.props.children[1].props.children[0].props.children[0].props
        .children,
    ).toBe("NDP46-KB3045557-x86-x64-AllOS-ENU.exe.qdl");
    expect(
      block.props.children[1].props.children[0].props.children[1].props
        .children,
    ).toBe("Attachment unavailable");
  });

  it("uses a fallback that accounts for missing access", () => {
    const block = InvalidAttachmentBlock();
    expect(block.props.children[1].props.children[1].props.children).toBe(
      "This attachment is temporarily unavailable for download. It may have been deleted, or you may not have access to it.",
    );
  });
});
