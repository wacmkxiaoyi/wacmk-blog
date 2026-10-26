import { afterEach, describe, expect, it, vi } from "vitest";
import {
  navigateToContentHeading,
  observeActiveHeading,
} from "../react/navigation/index.ts";

function createHeadingElement(id) {
  return {
    id,
    focus: vi.fn(),
    scrollIntoView: vi.fn(),
    getAttribute: vi.fn((name) =>
      name === "data-content-heading-id" ? id : null,
    ),
    getBoundingClientRect: vi.fn(() => ({ top: 220 })),
  };
}

describe("content-renderer navigation react", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("navigates to a heading id and updates hash when requested", () => {
    const heading = createHeadingElement("section-a");
    const replaceState = vi.fn();
    const doc = {
      querySelector: vi.fn((selector) =>
        selector === '[data-content-heading-id="section-a"]' ? heading : null,
      ),
      getElementById: vi.fn(() => heading),
      location: { pathname: "/docs", search: "?tab=intro" },
      defaultView: {
        scrollY: 0,
        history: { replaceState },
      },
    };

    const didNavigate = navigateToContentHeading("section-a", {
      root: doc,
      updateHash: true,
    });

    expect(didNavigate).toBe(true);
    expect(doc.querySelector).toHaveBeenCalledWith(
      '[data-content-heading-id="section-a"]',
    );
    expect(heading.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/docs?tab=intro#section-a",
    );
  });

  it("uses offset scrolling and supports menu item input", () => {
    const heading = createHeadingElement("section-b");
    const scrollTo = vi.fn();
    const doc = {
      querySelector: vi.fn((selector) =>
        selector === '[data-content-heading-id="section-b"]' ? heading : null,
      ),
      getElementById: vi.fn(() => heading),
      defaultView: {
        scrollY: 0,
        scrollTo,
      },
    };

    const didNavigate = navigateToContentHeading(
      { id: "section-b" },
      { root: doc, offsetTop: 80, focus: true },
    );

    expect(didNavigate).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 140, behavior: "smooth" });
    expect(heading.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("returns false when target heading is missing", () => {
    const doc = {
      getElementById: vi.fn(() => null),
    };

    expect(navigateToContentHeading("missing-heading", { root: doc })).toBe(
      false,
    );
  });

  it("observes the active heading and keeps it active until the next heading", () => {
    const listeners = new Map();
    const root = {
      scrollTop: 0,
      addEventListener: vi.fn((type, handler) => listeners.set(type, handler)),
      removeEventListener: vi.fn((type) => listeners.delete(type)),
      getBoundingClientRect: vi.fn(() => ({ top: 100 })),
    };
    const first = {
      id: "first",
      getAttribute: vi.fn((name) =>
        name === "data-content-heading-id" ? "first" : null,
      ),
      getBoundingClientRect: vi.fn(() => ({ top: 100 - root.scrollTop })),
    };
    const second = {
      id: "second",
      getAttribute: vi.fn((name) =>
        name === "data-content-heading-id" ? "second" : null,
      ),
      getBoundingClientRect: vi.fn(() => ({ top: 420 - root.scrollTop })),
    };
    const doc = {
      querySelector: vi.fn((selector) => {
        if (selector === '[data-content-heading-id="first"]') {
          return first;
        }
        if (selector === '[data-content-heading-id="second"]') {
          return second;
        }
        return null;
      }),
      getElementById: vi.fn((id) => (id === "first" ? first : second)),
    };
    const changes = [];

    vi.stubGlobal("document", doc);

    const stop = observeActiveHeading(
      [
        { id: "first", level: 2, text: "First", children: [] },
        { id: "second", level: 2, text: "Second", children: [] },
      ],
      (id) => changes.push(id),
      { root, offsetTop: 16 },
    );

    expect(changes).toEqual(["first"]);

    root.scrollTop = 250;
    listeners.get("scroll")?.();
    expect(changes).toEqual(["first"]);

    root.scrollTop = 450;
    listeners.get("scroll")?.();
    expect(changes).toEqual(["first", "second"]);

    stop();
    expect(root.removeEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
    );
  });

  it("prefers the scoped heading marker over the dom id when tracking active heading", () => {
    const listeners = new Map();
    const root = {
      scrollTop: 0,
      addEventListener: vi.fn((type, handler) => listeners.set(type, handler)),
      removeEventListener: vi.fn((type) => listeners.delete(type)),
      getBoundingClientRect: vi.fn(() => ({ top: 0 })),
      querySelector: vi.fn((selector) =>
        selector === '[data-content-heading-id="section-a"]'
          ? {
              id: "cr-preview-section-a",
              getAttribute: vi.fn((name) =>
                name === "data-content-heading-id" ? "section-a" : null,
              ),
              getBoundingClientRect: vi.fn(() => ({ top: 0 })),
            }
          : null,
      ),
    };
    const changes = [];

    const stop = observeActiveHeading(
      [{ id: "section-a", level: 2, text: "Section A", children: [] }],
      (id) => changes.push(id),
      { root, offsetTop: 0 },
    );

    expect(changes).toEqual(["section-a"]);
    stop();
  });

  it("allows anchor-like click handlers to navigate within a scoped root and update the canonical hash", () => {
    const scrollIntoView = vi.fn();
    const heading = {
      id: "cr-preview-shared-heading",
      getAttribute: vi.fn((name) =>
        name === "data-content-heading-id" ? "shared-heading" : null,
      ),
      scrollIntoView,
      getBoundingClientRect: vi.fn(() => ({ top: 120 })),
    };
    const replaceState = vi.fn();
    const root = {
      querySelector: vi.fn((selector) =>
        selector === '[data-content-heading-id="shared-heading"]'
          ? heading
          : null,
      ),
      contains: vi.fn((element) => element === heading),
      ownerDocument: {
        location: { pathname: "/test/frontend/packages/editor", search: "" },
        defaultView: {
          history: { replaceState },
        },
      },
    };

    const didNavigate = navigateToContentHeading("shared-heading", {
      root,
      updateHash: true,
    });

    expect(didNavigate).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/test/frontend/packages/editor#shared-heading",
    );
  });
});
