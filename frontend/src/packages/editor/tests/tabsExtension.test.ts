import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Editor } from "@tiptap/core";
import {
  buildUniqueTabItems,
  findTabItemPosByKey,
  insertTabIntoTabs,
} from "../react/components/RichTextEditor/helpers/richTextEditorRuntime.ts";
import { createRichTextEditorExtensions } from "../react/components/RichTextEditor/extensions/index.ts";
import { makeBridgeRef } from "../react/components/RichTextEditor/extensions/bridge/makeBridgeRef.ts";
import { buildTabsContextMenuGroups } from "../react/components/RichTextEditor/extensions/shared.tsx";
import {
  createDefaultTab,
  createDefaultTabsBlockContent,
} from "../react/components/RichTextEditor/helpers/customBlockHelpers.ts";

function createEditor(content) {
  return new Editor({
    extensions: createRichTextEditorExtensions({
      labelsRef: {
        current: {
          copy: "Copy",
          copied: "Copied",
          expand: "Expand",
          collapse: "Collapse",
          permalink: "Permalink",
        },
      },
      bridgeRef: { current: makeBridgeRef() },
      customBlockRegistryRef: { current: {} },
    }),
    content,
  });
}

describe("editor tabs extension", () => {
  it("normalizes duplicate or missing tab keys into unique values", () => {
    const items = buildUniqueTabItems([
      { attrs: { key: "tab-2", label: "Alpha" } },
      { attrs: { key: "", label: "Beta" } },
      { attrs: { key: "tab-2", label: "Gamma" } },
    ]);

    expect(items.map((item) => item.key)).toEqual([
      "tab-2",
      "tab-2-2",
      "tab-2-3",
    ]);
  });

  it("accepts a translated default tab label", () => {
    expect(createDefaultTab(2, "第 2 页").label).toBe("第 2 页");
  });

  it("interpolates case-insensitive index placeholders in tab labels", () => {
    expect(createDefaultTab(2, "选项卡 {index}").label).toBe("选项卡 2");
    expect(createDefaultTab(3, "选项卡 {INDEX}").label).toBe("选项卡 3");
    expect(createDefaultTabsBlockContent("选项卡 {index}")[0].attrs.label).toBe(
      "选项卡 1",
    );
  });

  it("treats tabsBlock as an isolating node", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "tabsBlock",
          attrs: { indent: 0 },
          content: [
            {
              type: "tabItem",
              attrs: { key: "tab-1", label: "Tab 1" },
              content: [{ type: "paragraph" }],
            },
          ],
        },
      ],
    });

    expect(editor.schema.nodes.tabsBlock.spec.isolating).toBe(true);
  });

  it("refuses to insert a tab into a non-tabs node", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      ],
    });

    expect(insertTabIntoTabs(editor, 0, "tab-2", "Tab 2")).toBe(false);
  });

  it("builds tabs context actions for add and delete", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "tabsBlock",
          attrs: { indent: 0 },
          content: [
            {
              type: "tabItem",
              attrs: { key: "tab-1", label: "Tab 1" },
              content: [{ type: "paragraph" }],
            },
            {
              type: "tabItem",
              attrs: { key: "tab-2", label: "Tab 2" },
              content: [{ type: "paragraph" }],
            },
          ],
        },
      ],
    });

    const tabsNode = editor.state.doc.nodeAt(0);
    const groups = buildTabsContextMenuGroups({
      editor,
      translate: (_key, fallback) => fallback,
      tabsNode,
      tabsPos: 0,
      target: {
        closest(selector) {
          return selector === "[data-editor-tab-key]"
            ? { getAttribute: () => "tab-2" }
            : null;
        },
      } as unknown as HTMLElement,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].children.map((item) => item.key)).toEqual([
      "tabs-add",
      "tabs-delete",
    ]);
    expect(groups[0].children[1].disabled).toBe(false);
    expect(findTabItemPosByKey(tabsNode, 0, "tab-2")).toBe(5);
  });

  it("prevents right-click mousedown on tab headers from changing selection", () => {
    const source = readFileSync(
      new URL(
        "../react/components/RichTextEditor/extensions/nodes/blockNodes.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(source).toContain("if (event.button !== 0 && event.button !== 2)");
    expect(source).toContain("event.preventDefault();");
    expect(source).toContain("onMouseDown={handleTabPointerDown}");
  });

  it("moves the editor selection when activating a tab header", () => {
    const source = readFileSync(
      new URL(
        "../react/components/RichTextEditor/extensions/nodes/blockNodes.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(source).toContain("function moveSelectionToTab(itemPos)");
    expect(source).toContain(
      "Selection.near(state.doc.resolve(selectionPos), 1)",
    );
    expect(source).toContain(
      "function activateTab(item, nextEditingKey: string | null = null)",
    );
    expect(source).toContain("onClick={() => activateTab(item)}");
    expect(source).toContain(
      "onDoubleClick={() => activateTab(item, item.key)}",
    );
  });
});
