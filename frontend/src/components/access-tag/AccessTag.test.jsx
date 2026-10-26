import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nContext } from "../../i18n/I18nContext";
import AccessTag from "./AccessTag";

function renderTag(props) {
  return renderToStaticMarkup(
    <I18nContext.Provider value={{ t: (key, vars = {}) => vars.count || key }}>
      <AccessTag {...props} />
    </I18nContext.Provider>,
  );
}

describe("AccessTag", () => {
  it("shows the condition count in an icon-only summary", () => {
    const markup = renderTag({
      type: "conditional",
      iconOnly: true,
      value: [
        { type: "money", value: 10 },
        { type: "encrypted" },
        { type: "book_only" },
      ],
    });

    expect(markup).toContain(">3</span>");
    expect(markup).not.toContain("access-tag__vip");
  });

  it("uses the VIP icon before the count in an icon-only summary", () => {
    const markup = renderTag({
      type: "conditional",
      iconOnly: true,
      isVIP: true,
      value: [
        { type: "money", value: 10 },
        { type: "encrypted" },
        { type: "book_only" },
      ],
    });

    expect(markup).toContain("access-tag__vip");
    expect(markup).toContain(">3</span>");
    expect(markup).toContain("access-tag--icon-only");
    expect(markup).toContain(">VIP</span>");
  });
});
