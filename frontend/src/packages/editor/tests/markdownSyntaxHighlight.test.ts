import { describe, expect, it } from "vitest";
import { highlightExtendedMarkdown } from "../react/components/RichTextEditor/helpers/markdownHighlighting.ts";

describe("editor markdown syntax highlighting", () => {
  it("highlights admonition markers, variants, and titles", () => {
    const html = highlightExtendedMarkdown('???+ note "Heads up"');

    expect(html).toContain("token admonition-marker");
    expect(html).toContain("token admonition-variant");
    expect(html).toContain(" note");
    expect(html).toContain("token admonition-title");
  });

  it("highlights tabs syntax", () => {
    const html = highlightExtendedMarkdown('=== "Overview"');

    expect(html).toContain("token tabs-marker");
    expect(html).toContain("token tabs-label");
  });

  it("highlights custom directives and attributes", () => {
    const html = highlightExtendedMarkdown(
      '::custom{kind="email-form" title="Newsletter signup"}',
    );

    expect(html).toContain("token directive-name");
    expect(html).toContain("directive-kind-value");
    expect(html).toContain("token directive-attr-name");
    expect(html).toContain("token directive-attr-value");
  });

  it("highlights video directives and attributes", () => {
    const html = highlightExtendedMarkdown(
      '::video{src="https://example.com/demo.mp4" title="Demo" muted="true"}',
    );

    expect(html).toContain("token directive-name");
    expect(html).toContain("token directive-attr-name");
    expect(html).toContain("token directive-attr-value");
  });

  it("highlights anchor directives and attributes", () => {
    const html = highlightExtendedMarkdown('::anchor{id="anchor-1"}');

    expect(html).toContain("token directive-name");
    expect(html).toContain("token directive-attr-name");
    expect(html).toContain("token directive-attr-value");
  });

  it("highlights html directive blocks", () => {
    const html = highlightExtendedMarkdown(
      ["::html", ":: <div>Hello</div>"].join("\n"),
    );

    expect(html).toContain("token directive-name");
    expect(html).toContain("directive-html-content");
  });

  it("highlights md-color inline syntax", () => {
    const html = highlightExtendedMarkdown("[蓝色强调]{.md-color-blue}");

    expect(html).toContain("token color-text-label");
    expect(html).toContain("token color-text-class-prefix");
    expect(html).toContain("token color-text-token blue");
  });
});
