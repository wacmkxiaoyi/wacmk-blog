import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import * as XLSX from "xlsx";
import {
  createInlinePalettePosition,
  createModalSubmitter,
  isCanonicalEmptyEditorDocument,
  isClickBelowEditorContent,
  insertMarkdownTable,
  moveEditorCaretToEnd,
  moveEditorCaretToStart,
  parseDelimitedTable,
  placeCaretWhenClickingBelowEditorContent,
  spreadsheetSheetToTableRows,
  tableRowsToMarkdown,
} from "../react/components/RichTextEditor/helpers/richTextEditorRuntime.ts";

const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.window = originalWindow;
});

describe("editor inline panel positioning", () => {
  it("places the panel below and aligned with its trigger", () => {
    globalThis.window = { innerWidth: 1280, innerHeight: 800 };

    expect(
      createInlinePalettePosition(
        null,
        { top: 100, left: 200, bottom: 140 },
        { width: 180, height: 120 },
      ),
    ).toEqual({ top: 148, left: 200 });
  });

  it("keeps the panel inside the right viewport edge", () => {
    globalThis.window = { innerWidth: 400, innerHeight: 800 };

    expect(
      createInlinePalettePosition(
        null,
        { top: 100, left: 360, bottom: 140 },
        { width: 180, height: 120 },
      ),
    ).toEqual({ top: 148, left: 212 });
  });

  it("places the panel above the trigger when space below is insufficient", () => {
    globalThis.window = { innerWidth: 1280, innerHeight: 400 };

    expect(
      createInlinePalettePosition(
        null,
        { top: 300, left: 200, bottom: 340 },
        { width: 180, height: 120 },
      ),
    ).toEqual({ top: 172, left: 200 });
  });

  it("returns coordinates relative to the editor container", () => {
    globalThis.window = { innerWidth: 1280, innerHeight: 800 };

    expect(
      createInlinePalettePosition(
        null,
        { top: 300, left: 500, bottom: 340 },
        { width: 180, height: 120 },
        { top: 200, left: 400 },
      ),
    ).toEqual({ top: 148, left: 100 });
  });
});

describe("editor rich text runtime modal submission", () => {
  it("uses supplied labels when inserting a markdown table", () => {
    const insertMarkdown = vi.fn();

    insertMarkdownTable(insertMarkdown, 2, 2, {
      header: "表头",
      cell: "单元格",
    });

    expect(insertMarkdown).toHaveBeenCalledWith(
      "| 表头 | 表头 |\n| --- | --- |\n| 单元格 | 单元格 |",
    );
  });

  it("parses CSV fields with quoted delimiters and escaped quotes", () => {
    expect(parseDelimitedTable('Name,Note\nAlice,"One, ""two"""', ",")).toEqual(
      [
        ["Name", "Note"],
        ["Alice", 'One, "two"'],
      ],
    );
  });

  it("preserves line breaks inside quoted CSV fields", () => {
    expect(
      parseDelimitedTable('Name,Note\nAlice,"First line\nSecond line"', ","),
    ).toEqual([
      ["Name", "Note"],
      ["Alice", "First line\nSecond line"],
    ]);
  });

  it("parses TSV rows and writes the first row as the table header", () => {
    const rows = parseDelimitedTable("Name\tAge\nAlice\t30", "\t");

    expect(tableRowsToMarkdown(rows)).toBe(
      "| Name | Age |\n| --- | --- |\n| Alice | 30 |",
    );
  });

  it("converts worksheet cells into table rows with blank cells preserved", () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Name", "Age"],
      ["Alice", undefined],
    ]);

    expect(spreadsheetSheetToTableRows(sheet, XLSX.utils)).toEqual([
      ["Name", "Age"],
      ["Alice", ""],
    ]);
  });

  it("inserts current article links in markdown mode", () => {
    const replaceMarkdownSelection = vi.fn();
    const closeModal = vi.fn();
    const submit = createModalSubmitter({
      modalState: {
        type: "link-current-article",
        payload: {
          headingOptions: [{ id: "details", text: "Details", level: 2 }],
          targetId: "details",
        },
      },
      getState: () => ({
        label: "Read details",
        url: "",
        formula: "",
        anchorName: "",
        linkType: "section",
        targetId: "details",
      }),
      editor: null,
      markdownMode: true,
      insertMarkdown: vi.fn(),
      replaceMarkdownSelection,
      updateCustomNode: vi.fn(),
      closeModal,
    });

    submit();

    expect(replaceMarkdownSelection).toHaveBeenCalledTimes(1);
    const updater = replaceMarkdownSelection.mock.calls[0][0];
    expect(updater("")).toEqual({ text: "[Read details](#details)" });
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it("inserts current article links in visual mode using the selected heading label fallback", () => {
    const closeModal = vi.fn();
    const run = vi.fn().mockReturnValue(true);
    const insertContent = vi.fn().mockReturnValue({ run });
    const focus = vi.fn().mockReturnValue({ insertContent });
    const chain = vi.fn().mockReturnValue({ focus });
    const editor = {
      state: {
        selection: { from: 1, to: 1 },
        doc: {
          textBetween: vi.fn().mockReturnValue(""),
        },
      },
      chain,
      view: {
        dom: {
          ownerDocument: {
            defaultView: {
              requestAnimationFrame: (callback) => callback(),
            },
          },
        },
        coordsAtPos: vi.fn().mockReturnValue({ top: 0 }),
        dispatch: vi.fn(),
      },
      commands: {
        focus: vi.fn(),
      },
    };

    const submit = createModalSubmitter({
      modalState: {
        type: "link-current-article",
        payload: {
          headingOptions: [{ id: "intro", text: "Intro", level: 1 }],
          targetId: "intro",
        },
      },
      getState: () => ({
        label: "",
        url: "",
        formula: "",
        anchorName: "",
        linkType: "section",
        targetId: "intro",
      }),
      editor,
      markdownMode: false,
      insertMarkdown: vi.fn(),
      replaceMarkdownSelection: vi.fn(),
      updateCustomNode: vi.fn(),
      closeModal,
    });

    submit();

    expect(insertContent).toHaveBeenCalledWith({
      type: "text",
      text: "Intro",
      marks: [{ type: "link", attrs: { href: "#intro" } }],
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it("inserts formula links in markdown mode", () => {
    const replaceMarkdownSelection = vi.fn();
    const closeModal = vi.fn();
    const submit = createModalSubmitter({
      modalState: {
        type: "link-current-article",
        payload: {
          formulaOptions: [{ id: "equation-2", text: "Equation 2", number: 2 }],
          targetId: "equation-2",
        },
      },
      getState: () => ({
        label: "",
        url: "",
        formula: "",
        anchorName: "",
        linkType: "formula",
        targetId: "equation-2",
      }),
      editor: null,
      markdownMode: true,
      insertMarkdown: vi.fn(),
      replaceMarkdownSelection,
      updateCustomNode: vi.fn(),
      closeModal,
    });

    submit();

    expect(replaceMarkdownSelection).toHaveBeenCalledTimes(1);
    const updater = replaceMarkdownSelection.mock.calls[0][0];
    expect(updater("")).toEqual({ text: "[Equation 2](#equation-2)" });
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it("inserts anchor links in markdown mode", () => {
    const replaceMarkdownSelection = vi.fn();
    const closeModal = vi.fn();
    const submit = createModalSubmitter({
      modalState: {
        type: "link-current-article",
        payload: {
          anchorOptions: [{ id: "foo-bar", text: "foo-bar" }],
          targetId: "foo-bar",
        },
      },
      getState: () => ({
        label: "",
        url: "",
        formula: "",
        anchorName: "",
        linkType: "anchor",
        targetId: "foo-bar",
      }),
      editor: null,
      markdownMode: true,
      insertMarkdown: vi.fn(),
      replaceMarkdownSelection,
      updateCustomNode: vi.fn(),
      closeModal,
    });

    submit();

    expect(replaceMarkdownSelection).toHaveBeenCalledTimes(1);
    const updater = replaceMarkdownSelection.mock.calls[0][0];
    expect(updater("")).toEqual({ text: "[foo-bar](#foo-bar)" });
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it("inserts anchor directive in markdown mode", () => {
    const insertMarkdown = vi.fn();
    const closeModal = vi.fn();
    const submit = createModalSubmitter({
      modalState: {
        type: "anchor",
        payload: {},
      },
      getState: () => ({
        label: "",
        url: "",
        formula: "",
        anchorName: "foo-bar",
        linkType: "section",
        targetId: "",
      }),
      editor: null,
      markdownMode: true,
      insertMarkdown,
      replaceMarkdownSelection: vi.fn(),
      updateCustomNode: vi.fn(),
      closeModal,
    });

    submit();

    expect(insertMarkdown).toHaveBeenCalledWith('::anchor{id="foo-bar"}');
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it("inserts anchor block in visual mode", () => {
    const updateCustomNode = vi.fn();
    const closeModal = vi.fn();
    const submit = createModalSubmitter({
      modalState: {
        type: "anchor",
        payload: {},
      },
      getState: () => ({
        label: "",
        url: "",
        formula: "",
        anchorName: "foo-bar",
        linkType: "section",
        targetId: "",
      }),
      editor: {},
      markdownMode: false,
      insertMarkdown: vi.fn(),
      replaceMarkdownSelection: vi.fn(),
      updateCustomNode,
      closeModal,
    });

    submit();

    expect(updateCustomNode).toHaveBeenCalledWith(undefined, "anchorBlock", {
      id: "foo-bar",
    });
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it("inserts html block markdown from the html modal", () => {
    const insertMarkdown = vi.fn();
    const closeModal = vi.fn();
    const submit = createModalSubmitter({
      modalState: {
        type: "html",
        payload: {},
      },
      getState: () => ({
        label: "",
        url: "",
        formula: "",
        html: "<div>one</div>\n<script>two()</script>",
        anchorName: "",
        linkType: "section",
        targetId: "",
      }),
      editor: null,
      markdownMode: true,
      insertMarkdown,
      replaceMarkdownSelection: vi.fn(),
      updateCustomNode: vi.fn(),
      closeModal,
    });

    submit();

    expect(insertMarkdown).toHaveBeenCalledWith(
      ["::html", ":: <div>one</div>", ":: <script>two()</script>"].join("\n"),
    );
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it("updates html custom block in visual mode", () => {
    const updateCustomNode = vi.fn();
    const closeModal = vi.fn();
    const submit = createModalSubmitter({
      modalState: {
        type: "html",
        payload: { pos: 14 },
      },
      getState: () => ({
        label: "",
        url: "",
        formula: "",
        html: "<div>preview</div>",
        anchorName: "",
        linkType: "section",
        targetId: "",
      }),
      editor: {},
      markdownMode: false,
      insertMarkdown: vi.fn(),
      replaceMarkdownSelection: vi.fn(),
      updateCustomNode,
      closeModal,
    });

    submit();

    expect(updateCustomNode).toHaveBeenCalledWith(14, "customBlock", {
      kind: "html",
      data: { html: "<div>preview</div>" },
      indent: 0,
    });
    expect(closeModal).toHaveBeenCalledTimes(1);
  });
});

describe("editor visual cursor placement", () => {
  it("recognizes clicks below the last content block", () => {
    const view = {
      dom: {
        lastElementChild: {
          getBoundingClientRect: () => ({ bottom: 120 }),
        },
      },
    };

    expect(isClickBelowEditorContent(view, 121)).toBe(true);
  });

  it("does not recognize clicks within the final content block", () => {
    const view = {
      dom: {
        lastElementChild: {
          getBoundingClientRect: () => ({ bottom: 120 }),
        },
      },
    };

    expect(isClickBelowEditorContent(view, 120)).toBe(false);
  });

  it("recognizes the canonical empty paragraph document", () => {
    const schema = new Schema({
      nodes: {
        doc: { content: "block+" },
        paragraph: { content: "text*", group: "block" },
        image: { group: "block", atom: true },
        text: { group: "inline" },
      },
    });

    expect(
      isCanonicalEmptyEditorDocument(
        schema.node("doc", null, [schema.node("paragraph")]),
      ),
    ).toBe(true);
    expect(isCanonicalEmptyEditorDocument({ childCount: 0 })).toBe(true);
    expect(
      isCanonicalEmptyEditorDocument(
        schema.node("doc", null, [schema.node("image")]),
      ),
    ).toBe(false);
  });

  it("places the first click in an empty editor at the paragraph start", () => {
    const schema = new Schema({
      nodes: {
        doc: { content: "block+" },
        paragraph: { content: "text*", group: "block" },
        text: { group: "inline" },
      },
    });
    const doc = schema.node("doc", null, [schema.node("paragraph")]);
    const transaction = { setSelection: vi.fn().mockReturnThis() };
    const view = {
      dom: {
        lastElementChild: {
          getBoundingClientRect: () => ({ bottom: 120 }),
        },
      },
      state: { doc, tr: transaction },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };
    const event = {
      button: 0,
      clientY: 10,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    expect(placeCaretWhenClickingBelowEditorContent(view, event)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(transaction.setSelection).toHaveBeenCalledWith(
      TextSelection.create(doc, 1),
    );
    expect(view.dispatch).toHaveBeenCalledWith(transaction);
    expect(view.focus).toHaveBeenCalledTimes(1);
  });

  it("creates the first paragraph when clicking a zero-child editor", () => {
    const schema = new Schema({
      nodes: {
        doc: { content: "block*" },
        paragraph: { content: "text*", group: "block" },
        text: { group: "inline" },
      },
    });
    const initialDoc = { childCount: 0 };
    const doc = schema.node("doc", null, [schema.node("paragraph")]);
    const transaction = {
      doc,
      insert: vi.fn().mockImplementation((_position, paragraph) => {
        transaction.doc = schema.node("doc", null, [paragraph]);
        return transaction;
      }),
      setSelection: vi.fn().mockReturnThis(),
    };
    const view = {
      state: { doc: initialDoc, schema, tr: transaction },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };
    const event = {
      button: 0,
      clientY: 200,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    expect(placeCaretWhenClickingBelowEditorContent(view, event)).toBe(true);
    expect(transaction.insert).toHaveBeenCalledWith(
      0,
      schema.node("paragraph"),
    );
    expect(transaction.setSelection).toHaveBeenCalledWith(
      TextSelection.create(transaction.doc, 1),
    );
    expect(view.dispatch).toHaveBeenCalledWith(transaction);
    expect(view.focus).toHaveBeenCalledTimes(1);
  });

  it("intercepts a click below content before moving the caret to the end", () => {
    const schema = new Schema({
      nodes: {
        doc: { content: "block+" },
        paragraph: { content: "text*", group: "block" },
        text: { group: "inline" },
      },
    });
    const doc = schema.node("doc", null, [schema.node("paragraph")]);
    const transaction = { setSelection: vi.fn().mockReturnThis() };
    const view = {
      dom: {
        lastElementChild: {
          getBoundingClientRect: () => ({ bottom: 120 }),
        },
      },
      state: { doc, tr: transaction },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };
    const event = {
      button: 0,
      clientY: 121,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    expect(placeCaretWhenClickingBelowEditorContent(view, event)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(view.dispatch).toHaveBeenCalledWith(transaction);
    expect(view.focus).toHaveBeenCalledTimes(1);
  });

  it("moves the caret to the document end", () => {
    const schema = new Schema({
      nodes: {
        doc: { content: "block+" },
        paragraph: { content: "text*", group: "block" },
        text: { group: "inline" },
      },
    });
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [schema.text("content")]),
    ]);
    const transaction = {
      setSelection: vi.fn().mockReturnThis(),
    };
    const view = {
      state: { doc, tr: transaction },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };

    expect(moveEditorCaretToEnd(view)).toBe(true);
    expect(transaction.setSelection).toHaveBeenCalledTimes(1);
    expect(view.dispatch).toHaveBeenCalledWith(transaction);
    expect(view.focus).toHaveBeenCalledTimes(1);
  });

  it("moves the caret to the first position in an empty paragraph", () => {
    const schema = new Schema({
      nodes: {
        doc: { content: "block+" },
        paragraph: { content: "text*", group: "block" },
        text: { group: "inline" },
      },
    });
    const doc = schema.node("doc", null, [schema.node("paragraph")]);
    const transaction = { setSelection: vi.fn().mockReturnThis() };
    const view = {
      state: { doc, tr: transaction },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };

    expect(moveEditorCaretToStart(view)).toBe(true);
    expect(transaction.setSelection).toHaveBeenCalledWith(
      TextSelection.create(doc, 1),
    );
    expect(view.dispatch).toHaveBeenCalledWith(transaction);
    expect(view.focus).toHaveBeenCalledTimes(1);
  });
});

afterAll(() => {
  globalThis.window = originalWindow;
});
