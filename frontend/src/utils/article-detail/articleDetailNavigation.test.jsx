import { describe, expect, it } from "vitest";

import {
  createBookNavigatorItems,
  updateCommentInThreads,
} from "./articleDetailNavigation.jsx";

describe("article detail navigation", () => {
  it("preserves catalog groups and marks the current article", () => {
    const items = createBookNavigatorItems(
      {
        structure: [
          {
            type: "group",
            title: "Part one",
            children: [{ type: "article", article_id: 2 }],
          },
        ],
      },
      [{ id: 2, title: "Chapter", visibility: "public" }],
      2,
    );
    expect(items[0].clickable).toBe(false);
    expect(items[0].children[0].key).toBe("article-2");
    expect(items[0].children[0].active).toBe(true);
    expect(items[0].children[0].label.props.children[0].props.children).toBe(
      "Chapter",
    );
  });

  it("matches catalog IDs regardless of API number serialization", () => {
    const items = createBookNavigatorItems(
      {
        structure: [
          {
            type: "group",
            title: "Part one",
            children: [{ type: "article", article_id: 2 }],
          },
        ],
      },
      [{ id: "2", title: "Chapter", visibility: "public" }],
      2,
    );
    expect(items[0]).toMatchObject({ key: "group-0" });
    expect(items[0].children[0]).toMatchObject({
      key: "article-2",
      active: true,
    });
  });

  it("creates unique group keys for nested groups with the same title", () => {
    const items = createBookNavigatorItems(
      {
        structure: [
          {
            type: "group",
            title: "Section",
            children: [
              {
                type: "group",
                title: "Section",
                children: [{ type: "article", article_id: 1 }],
              },
            ],
          },
        ],
      },
      [{ id: 1, title: "Chapter", visibility: "public" }],
      1,
    );
    expect(items[0].key).toBe("group-0");
    expect(items[0].children[0].key).toBe("group-0-0");
  });

  it("renders the article title with common and VIP access tags", () => {
    const items = createBookNavigatorItems(
      { structure: [{ type: "article", article_id: 1 }] },
      [
        {
          id: 1,
          title: "Chapter",
          visibility: "private",
          access_scope: "standalone",
          vip_access_permission: "conditional",
          vip_condition_rules: [{ type: "points", value: 10 }],
        },
      ],
      1,
    );
    expect(items[0].data.accessChannels).toHaveLength(2);
    expect(items[0].label.props.children[0].props.children).toBe("Chapter");
    expect(items[0].label.props.children[1]).toHaveLength(2);
  });

  it("removes groups that have no visible articles", () => {
    const items = createBookNavigatorItems(
      {
        structure: [
          {
            type: "group",
            title: "Empty",
            children: [{ type: "article", article_id: 1 }],
          },
          {
            type: "group",
            title: "Visible",
            children: [{ type: "article", article_id: 2 }],
          },
        ],
      },
      [
        {
          id: 2,
          title: "Chapter",
          visibility: "conditional",
          condition_rules: [{ type: "points", value: 10 }],
        },
      ],
      2,
    );
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Visible");
    expect(items[0].children[0].data.article.id).toBe(2);
  });

  it("updates comments without replacing unrelated replies", () => {
    const result = updateCommentInThreads(
      [{ id: "1", replies: [{ id: "2", content: "old" }] }],
      "2",
      (comment) => ({ ...comment, content: "new" }),
    );
    expect(result[0].replies[0].content).toBe("new");
  });
});
