import { describe, expect, it } from "vitest";
import {
  parseMarkdownArticle,
  parseMarkdownFrontMatter,
} from "./markdownArticleImport";

describe("Markdown article import", () => {
  it("extracts supported front matter and preserves the Markdown body", () => {
    const article = parseMarkdownArticle(
      `---
TITLE: "Imported title"
abstract: |
  First line.
  Second line.
tags:
  - React
  - "Django"
slug: imported-post
ignored: value
---

# Body heading

Article body.`,
      "article.md",
      "Imported article",
    );

    expect(article).toMatchObject({
      title: "Imported title",
      slug: "imported-post",
      abstract: "First line.\nSecond line.",
      tag_names: "React, Django",
      content: "# Body heading\n\nArticle body.",
      visibility: "public",
      access_scope: "unified",
      vip_access_permission: "public",
    });
  });

  it("uses a heading, then a readable filename, as title fallbacks", () => {
    expect(
      parseMarkdownArticle(
        "# Heading\n\nText",
        "ignored.md",
        "Imported article",
      ).title,
    ).toBe("Heading");
    expect(
      parseMarkdownArticle("Text", "my_imported-post.md", "Imported article")
        .title,
    ).toBe("my imported post");
  });

  it("ignores headings inside fenced code blocks and derives a paragraph abstract", () => {
    const article = parseMarkdownArticle(
      "```md\n# Not a title\n```\n\nIntro line.\nContinues here.\n\n- List item",
      "post.md",
      "Imported article",
    );
    expect(article.title).toBe("post");
    expect(article.abstract).toBe("Intro line. Continues here.");
  });

  it("supports inline, bracketed, and folded metadata values", () => {
    const article = parseMarkdownArticle(
      `---
tags: ["one", two]
abstract: >
  Summary one
  Summary two
---
Text`,
      "post.md",
      "Imported article",
    );
    expect(article.tag_names).toBe("one, two");
    expect(article.abstract).toBe("Summary one Summary two");
  });

  it("leaves malformed front matter in the article body", () => {
    const source = "---\ntitle: Not metadata\n# Content";
    expect(parseMarkdownFrontMatter(source)).toEqual([{}, source]);
    expect(
      parseMarkdownArticle(source, "post.md", "Imported article").content,
    ).toBe(source);
  });
});
