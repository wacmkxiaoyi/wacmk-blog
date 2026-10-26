import { describe, expect, it } from "vitest";
import { HTML_TEMPLATES } from "../react/tools/HTMLTemplates/index.ts";

describe("HTML templates", () => {
  it("provides unique local templates with replacement guidance", () => {
    expect(HTML_TEMPLATES).toHaveLength(6);
    expect(new Set(HTML_TEMPLATES.map((template) => template.id)).size).toBe(
      HTML_TEMPLATES.length,
    );

    HTML_TEMPLATES.forEach((template) => {
      expect(template.html).toContain("<!--\n  Template:");
      expect(template.html).toContain("Instructions:");
      expect(template.html).toContain("<!-- Replace");
      expect(template.html).toContain(
        "html, body { width: 100%; margin: 0; padding: 0; }",
      );
      expect(template.html).not.toMatch(/max-width:\s*(720|760|880)px/);
      expect(template.html).not.toMatch(/margin:\s*0 auto/);
      expect(template.html).toContain("<");
      expect(template.nameKey).toMatch(/^editor\.htmlTemplate\./);
      expect(template.descriptionKey).toMatch(/^editor\.htmlTemplate\./);
    });
  });
});
