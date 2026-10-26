import { describe, expect, it } from "vitest";
import { createContentNavigation } from "../core/index.ts";

describe("content-renderer navigation core", () => {
  it("builds tree and flat menu items from headings", () => {
    const document = {
      type: "document",
      version: 1,
      format: "markdown",
      children: [
        {
          type: "heading",
          id: "intro",
          level: 1,
          children: [{ type: "text", value: "Intro" }],
          meta: { tocIncluded: true },
        },
        { type: "paragraph", children: [{ type: "text", value: "body" }] },
        {
          type: "heading",
          id: "details",
          level: 2,
          children: [{ type: "text", value: "Details" }],
          meta: { tocIncluded: true },
        },
        {
          type: "heading",
          id: "deep",
          level: 3,
          children: [{ type: "text", value: "Deep Dive" }],
          meta: { tocIncluded: true },
        },
      ],
    };

    const navigation = createContentNavigation(document);

    expect(navigation.items).toHaveLength(1);
    expect(navigation.items[0].id).toBe("intro");
    expect(navigation.items[0].children).toHaveLength(1);
    expect(navigation.items[0].children[0].id).toBe("details");
    expect(navigation.items[0].children[0].children[0].id).toBe("deep");
    expect(navigation.flatItems.map((item) => item.id)).toEqual([
      "intro",
      "details",
      "deep",
    ]);
    expect(navigation.getItemById("details")?.text).toBe("Details");
    expect(navigation.hasItem("deep")).toBe(true);
    expect(navigation.hasItem("missing")).toBe(false);
  });

  it("filters headings by visibility, id, title, and level", () => {
    const document = {
      type: "document",
      version: 1,
      format: "markdown",
      children: [
        {
          type: "heading",
          id: "h1",
          level: 1,
          children: [{ type: "text", value: "Top" }],
          meta: { tocIncluded: true },
        },
        {
          type: "heading",
          id: "hidden",
          level: 2,
          children: [{ type: "text", value: "Hidden" }],
          meta: { tocIncluded: false },
        },
        {
          type: "heading",
          level: 2,
          children: [{ type: "text", value: "No Id" }],
          meta: { tocIncluded: true },
        },
        {
          type: "heading",
          id: "empty",
          level: 2,
          children: [{ type: "text", value: "   " }],
          meta: { tocIncluded: true },
        },
        {
          type: "heading",
          id: "h2",
          level: 2,
          children: [{ type: "text", value: "Middle" }],
          meta: { tocIncluded: true },
        },
        {
          type: "heading",
          id: "h4",
          level: 4,
          children: [{ type: "text", value: "Lower" }],
          meta: { tocIncluded: true },
        },
      ],
    };

    const navigation = createContentNavigation(document, {
      minLevel: 2,
      maxLevel: 3,
    });
    expect(navigation.flatItems.map((item) => item.id)).toEqual(["h2"]);
  });

  it("supports flat output and item filter", () => {
    const document = {
      type: "document",
      version: 1,
      format: "markdown",
      children: [
        {
          type: "heading",
          id: "a",
          level: 2,
          children: [{ type: "text", value: "Alpha" }],
          meta: { tocIncluded: true },
        },
        {
          type: "heading",
          id: "b",
          level: 2,
          children: [{ type: "text", value: "Beta" }],
          meta: { tocIncluded: true },
        },
      ],
    };

    const navigation = createContentNavigation(document, {
      tree: false,
      filter: (item) => item.text !== "Beta",
    });

    expect(navigation.items).toEqual([
      { id: "a", level: 2, text: "Alpha", children: [] },
    ]);
    expect(navigation.flatItems).toEqual([
      { id: "a", level: 2, text: "Alpha", children: [] },
    ]);
  });

  it("returns an empty navigation for empty input", () => {
    const navigation = createContentNavigation(null);

    expect(navigation.document).toBeNull();
    expect(navigation.items).toEqual([]);
    expect(navigation.flatItems).toEqual([]);
    expect(navigation.getItemById("missing")).toBeNull();
  });
});
