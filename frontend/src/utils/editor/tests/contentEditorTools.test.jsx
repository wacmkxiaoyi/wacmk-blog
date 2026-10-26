import { describe, expect, it, vi } from "vitest";
import { InvalidAttachmentBlock } from "../../content-renderer/articleContentTemplate";
import {
  createContentEditorTools,
  extendContentEditorTools,
} from "../contentEditorTools";

describe("content editor tools", () => {
  const uploadConfig = {
    "upload.attachment": { allow_user_upload: true, vip_only: false },
    "upload.video": { allow_user_upload: true, vip_only: false },
  };

  it("adds business tools without replacing native editor tools", () => {
    const tools = createContentEditorTools({
      t: (_, fallback) => fallback,
      user: { id: 1 },
      config: uploadConfig,
    });
    expect(tools.map((tool) => tool.key)).toEqual([
      "content-image-upload",
      "content-video-upload",
      "content-article-reference",
      "content-attachment-library",
      "content-attachment",
    ]);
  });

  it("hides denied upload tools but keeps the attachment library", () => {
    const tools = createContentEditorTools({
      t: (_, fallback) => fallback,
      user: { id: 1, vip_level: 0 },
      config: {
        "upload.attachment": { allow_user_upload: false, vip_only: false },
        "upload.video": { allow_user_upload: true, vip_only: true },
      },
    });

    expect(tools.map((tool) => tool.key)).not.toContain("content-video-upload");
    expect(tools.map((tool) => tool.key)).not.toContain("content-attachment");
    expect(tools.map((tool) => tool.key)).toContain(
      "content-attachment-library",
    );
  });

  it("allows VIP users and administrators to upload when configured", () => {
    const vipConfig = {
      "upload.attachment": { allow_user_upload: true, vip_only: true },
      "upload.video": { allow_user_upload: true, vip_only: true },
    };
    const adminConfig = {
      "upload.attachment": { allow_user_upload: false, vip_only: true },
      "upload.video": { allow_user_upload: false, vip_only: true },
    };

    const vipTools = createContentEditorTools({
      t: (_, fallback) => fallback,
      user: { id: 1, vip_level: 1 },
      config: vipConfig,
    });
    const adminTools = createContentEditorTools({
      t: (_, fallback) => fallback,
      user: { id: 2, is_staff: true },
      config: adminConfig,
    });

    expect(vipTools.map((tool) => tool.key)).toContain("content-video-upload");
    expect(vipTools.map((tool) => tool.key)).toContain("content-attachment");
    expect(adminTools.map((tool) => tool.key)).toContain(
      "content-video-upload",
    );
    expect(adminTools.map((tool) => tool.key)).toContain("content-attachment");
  });

  it("opens attachment workflows with the editor context", () => {
    const openWorkflow = vi.fn();
    const tools = createContentEditorTools({
      t: (_, fallback) => fallback,
      user: { id: 1 },
      config: uploadConfig,
      openWorkflow,
    });

    tools
      .find((tool) => tool.key === "content-attachment")
      .executeMarkdown({ insertMarkdown: vi.fn() });

    expect(openWorkflow).toHaveBeenCalledWith(
      "attachment-upload",
      expect.any(Object),
    );
    expect(
      tools.find((tool) => tool.key === "content-attachment").subTools,
    ).toEqual(["content-attachment-library"]);
  });

  it("places upload and reference tools under their native parents", () => {
    const tools = extendContentEditorTools(
      [
        { key: "link", subTools: ["link-current-article"] },
        { key: "image" },
        { key: "video" },
        { key: "html", order: 5 },
      ],
      createContentEditorTools({
        t: (_, fallback) => fallback,
        user: { id: 1 },
        config: uploadConfig,
      }),
    );
    expect(tools.find((tool) => tool.key === "image").subTools).toContain(
      "content-image-upload",
    );
    expect(tools.find((tool) => tool.key === "video").subTools).toContain(
      "content-video-upload",
    );
    expect(tools.find((tool) => tool.key === "link").subTools).toContain(
      "content-article-reference",
    );
    expect(
      tools.find((tool) => tool.key === "content-attachment").order,
    ).toBeLessThan(5);
  });

  it("does not attach a missing video upload tool", () => {
    const tools = extendContentEditorTools(
      [{ key: "video", subTools: ["video-url"] }],
      createContentEditorTools({
        t: (_, fallback) => fallback,
        user: { id: 1 },
        config: {
          "upload.video": { allow_user_upload: false, vip_only: false },
        },
      }),
    );

    expect(tools.find((tool) => tool.key === "video").subTools).toEqual([
      "video-url",
    ]);
  });

  it("renders unavailable attachment blocks as invalid", () => {
    const tool = createContentEditorTools({
      t: (_, fallback) => fallback,
      attachments: {},
      user: { id: 1 },
      config: uploadConfig,
    }).find((item) => item.key === "content-attachment");

    const editorBlock = tool.customBlock.render({
      data: { attachmentId: "missing", assetId: "missing" },
    });
    const block = editorBlock.type(editorBlock.props);

    expect(block.type).toBe(InvalidAttachmentBlock);
  });
});
