import { buildHeadingSlug, classifyLink, createStableId } from "../../../core";

const CALLOUT_RE = /^>\s*\[!(NOTE|TIP|IMPORTANT|CAUTION|WARNING)\]\s*(.*)$/i;
const ADMONITION_RE =
  /^\s*(\?\?\?(\+)?|!!!)\s+(note|tip|warning|error)(?:\s+"([^"]+)")?\s*$/i;
const TAB_RE = /^\s*===\s+"([^"]+)"\s*$/;
const ANCHOR_RE = /^\s*::anchor\{([^}]*)\}\s*$/;
const CUSTOM_RE = /^\s*::custom\{([^}]*)\}\s*$/;
const HTML_START_RE = /^\s*::html\s*$/;
const HTML_LINE_RE = /^\s*:: ?(.*)$/;
const VIDEO_RE = /^\s*::video\{([^}]*)\}\s*$/;
const IMAGE_RE = /^!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]+)")?\)$/;
const LINK_RE = /^\[([^\]]+)\]\(([^\s)]+)(?:\s+"([^"]+)")?\)$/;
const LIST_MARKER_RE = /^(\s*)([-*+]|(\d+)\.)(\s+)(.*)$/;

function parseDirectiveAttributes(source) {
  const attrs = {};
  String(source || "").replace(/(\w+)="([^"]*)"/g, (_match, key, value) => {
    attrs[key] = value;
    return _match;
  });
  return attrs;
}

function unescapeInlineMath(value) {
  return String(value || "").replace(/\\\$/g, "$");
}

function createTextNode(value, marks) {
  if (!value) {
    return null;
  }
  return { type: "text", value, marks: marks?.length ? marks : undefined };
}

function parseInlineNodes(value) {
  const text = String(value || "");
  const nodes = [];
  let index = 0;

  const patterns = [
    { type: "checkbox", regex: /^\[(x|X)?\]/ },
    { type: "link", regex: /^\[([^\]]+)\]\(([^\s)]+)(?:\s+"([^"]+)")?\)/ },
    {
      type: "color",
      regex:
        /^\[([^\]]+)\]\{\.md-color-(berry|rose|orange|gold|green|cyan|blue|purple)\}/,
    },
    { type: "bold", regex: /^\*\*([^*]+)\*\*/ },
    { type: "italic", regex: /^\*([^*]+)\*/ },
    { type: "strike", regex: /^~~([^~]+)~~/ },
    { type: "underline", regex: /^\+\+([^+]+)\+\+/ },
    { type: "inline-code", regex: /^`([^`]+)`/ },
    { type: "inline-math", regex: /^\\\(([^)]+)\\\)/ },
    { type: "inline-math-dollar", regex: /^\$((?:\\\$|[^$\n])+?)\$/ },
    { type: "emoji", regex: /^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}])/u },
  ];

  while (index < text.length) {
    const slice = text.slice(index);
    let matched = false;

    for (const pattern of patterns) {
      const match = slice.match(pattern.regex);
      if (!match) {
        continue;
      }

      matched = true;
      if (pattern.type === "checkbox") {
        nodes.push({
          type: "checkbox",
          checked: String(match[1] || "").toLowerCase() === "x",
        });
      } else if (pattern.type === "link") {
        nodes.push({
          type: "link",
          href: match[2],
          title: match[3],
          children: parseInlineNodes(match[1]),
          meta: { kind: classifyLink(match[2]) },
        });
      } else if (pattern.type === "color") {
        nodes.push(
          createTextNode(match[1], [{ type: "color", value: match[2] }]),
        );
      } else if (pattern.type === "bold") {
        nodes.push(createTextNode(match[1], [{ type: "bold" }]));
      } else if (pattern.type === "italic") {
        nodes.push(createTextNode(match[1], [{ type: "italic" }]));
      } else if (pattern.type === "strike") {
        nodes.push(createTextNode(match[1], [{ type: "strike" }]));
      } else if (pattern.type === "underline") {
        nodes.push(createTextNode(match[1], [{ type: "underline" }]));
      } else if (pattern.type === "inline-code") {
        nodes.push({ type: "inline-code", value: match[1] });
      } else if (pattern.type === "inline-math") {
        nodes.push({ type: "inline-math", value: match[1] });
      } else if (pattern.type === "inline-math-dollar") {
        nodes.push({
          type: "inline-math",
          value: unescapeInlineMath(match[1]),
        });
      } else if (pattern.type === "emoji") {
        nodes.push({ type: "emoji", value: match[1] });
      }

      index += match[0].length;
      break;
    }

    if (matched) {
      continue;
    }

    let nextSpecialIndex = slice.length;
    ["[", "*", "~", "+", "`", "\\", "$", "😀"].forEach((symbol) => {
      const foundIndex = slice.indexOf(symbol);
      if (foundIndex !== -1) {
        nextSpecialIndex = Math.min(nextSpecialIndex, foundIndex);
      }
    });

    if (nextSpecialIndex === 0) {
      nextSpecialIndex = 1;
    }

    nodes.push(createTextNode(slice.slice(0, nextSpecialIndex)));
    index += nextSpecialIndex;
  }

  return nodes.filter(Boolean);
}

function createParagraph(value) {
  return {
    type: "paragraph",
    children: parseInlineNodes(value),
  };
}

function matchListMarker(line) {
  const match = String(line || "").match(LIST_MARKER_RE);
  if (!match) {
    return null;
  }

  const indent = match[1].length;
  const marker = match[2];
  const ordered = Boolean(match[3]);
  const spacing = match[4];

  return {
    indent,
    marker,
    ordered,
    start: ordered ? parseInt(match[3], 10) : undefined,
    contentIndent: indent + marker.length + spacing.length,
    text: match[5],
  };
}

function extractTaskCheckbox(text) {
  const match = String(text || "").match(/^\[( |x|X)\](?:\s+|$)(.*)$/);
  if (!match) {
    return { checked: null, text: String(text || "") };
  }

  return {
    checked: match[1].toLowerCase() === "x",
    text: match[2],
  };
}

function isBlockStarter(line) {
  const value = String(line || "");
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return Boolean(
    value.match(/^(#{1,6})\s+/) ||
    /^---+$/.test(trimmed) ||
    trimmed.startsWith("```") ||
    trimmed === "$$" ||
    (trimmed.startsWith("$$") &&
      trimmed.endsWith("$$") &&
      trimmed.length > 4) ||
    trimmed.match(CALLOUT_RE) ||
    trimmed.match(ADMONITION_RE) ||
    trimmed.match(TAB_RE) ||
    trimmed.match(CUSTOM_RE) ||
    trimmed.match(HTML_START_RE) ||
    trimmed.match(VIDEO_RE) ||
    trimmed.startsWith(">") ||
    matchListMarker(value) ||
    trimmed.startsWith("|") ||
    trimmed.match(IMAGE_RE),
  );
}

function parseTable(lines, startIndex) {
  const tableLines = [];
  let cursor = startIndex;
  while (cursor < lines.length && lines[cursor].trim().startsWith("|")) {
    tableLines.push(lines[cursor]);
    cursor += 1;
  }

  if (
    tableLines.length < 2 ||
    !/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(tableLines[1])
  ) {
    return null;
  }

  const splitRow = (row) => {
    let stripped = row.trim();
    if (stripped.startsWith("|")) stripped = stripped.slice(1);
    if (stripped.endsWith("|")) stripped = stripped.slice(0, -1);
    return stripped.split("|").map((cell) => cell.trim());
  };

  const headCells = splitRow(tableLines[0]);
  const align = splitRow(tableLines[1]).map((cell) => {
    if (/^:-+:$/.test(cell)) return "center";
    if (/^-+:$/.test(cell)) return "right";
    if (/^:-+$/.test(cell)) return "left";
    return null;
  });
  const bodyRows = tableLines.slice(2).map(splitRow);

  return {
    node: {
      type: "table",
      align,
      head: {
        type: "table-row",
        cells: headCells.map((cell) => ({
          type: "table-cell",
          header: true,
          children: [createParagraph(cell)],
        })),
      },
      body: bodyRows.map((row) => ({
        type: "table-row",
        cells: row.map((cell) => ({
          type: "table-cell",
          children: [createParagraph(cell)],
        })),
      })),
    },
    nextIndex: cursor,
  };
}

function parseBlockquote(lines, startIndex) {
  const blockLines = [];
  let cursor = startIndex;

  while (cursor < lines.length) {
    const match = lines[cursor].match(/^>\s?(.*)$/);
    if (!match) {
      break;
    }
    blockLines.push(match[1]);
    cursor += 1;
  }

  return {
    node: {
      type: "blockquote",
      children: linesToBlocks(blockLines),
    },
    nextIndex: cursor,
  };
}

function parseList(lines, startIndex) {
  const first = matchListMarker(lines[startIndex]);
  if (!first) {
    return null;
  }

  const ordered = first.ordered;
  const indent = first.indent;
  const items = [];
  let cursor = startIndex;

  while (cursor < lines.length) {
    const marker = matchListMarker(lines[cursor]);
    if (!marker || marker.indent !== indent || marker.ordered !== ordered) {
      break;
    }

    const itemLines = [marker.text];
    cursor += 1;
    while (cursor < lines.length) {
      const candidate = lines[cursor];
      if (!candidate.trim()) {
        itemLines.push("");
        cursor += 1;
        continue;
      }

      const siblingMarker = matchListMarker(candidate);
      if (
        siblingMarker &&
        siblingMarker.indent === indent &&
        siblingMarker.ordered === ordered
      ) {
        break;
      }

      const candidateIndent = candidate.length - candidate.trimStart().length;
      if (candidateIndent <= indent) {
        if (candidateIndent < indent) {
          break;
        }

        if (isBlockStarter(candidate.trimStart())) {
          break;
        }

        itemLines.push(candidate.trimStart());
        cursor += 1;
        continue;
      }

      if (candidateIndent >= marker.contentIndent) {
        itemLines.push(candidate.slice(marker.contentIndent));
      } else {
        itemLines.push(candidate.trimStart());
      }
      cursor += 1;
    }

    const firstLine = itemLines[0] || "";
    const task = extractTaskCheckbox(firstLine);
    itemLines[0] = task.text;
    const children = linesToBlocks(itemLines);

    items.push({
      type: "list-item",
      checked: task.checked != null ? task.checked : undefined,
      children,
    });
  }

  return {
    node: {
      type: "list",
      ordered,
      start: ordered ? first.start : undefined,
      items,
    },
    nextIndex: cursor,
  };
}

function collectIndentedBlock(lines, startIndex, baseIndent = 4) {
  const blockLines = [];
  let cursor = startIndex;
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (!line.trim()) {
      blockLines.push("");
      cursor += 1;
      continue;
    }
    const indent = line.length - line.trimStart().length;
    if (indent < baseIndent) {
      break;
    }
    blockLines.push(line.slice(baseIndent));
    cursor += 1;
  }
  return { lines: blockLines, nextIndex: cursor };
}

function linesToBlocks(lines) {
  return markdownToNodes(lines.join("\n")).children;
}

export function markdownToNodes(markdown) {
  const lines = String(markdown || "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const children = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const text = headingMatch[2].trim();
      const id = buildHeadingSlug(text) || createStableId("heading");
      children.push({
        type: "heading",
        level: headingMatch[1].length,
        id,
        children: parseInlineNodes(text),
        meta: { anchorable: true, tocIncluded: true },
      });
      index += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      children.push({ type: "horizontal-rule" });
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim() || undefined;
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      children.push({
        type: "code-block",
        value: codeLines.join("\n"),
        language,
      });
      continue;
    }

    if (trimmed === "$$") {
      const mathLines = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== "$$") {
        mathLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      children.push({ type: "math-block", value: mathLines.join("\n").trim() });
      continue;
    }

    const tableResult = parseTable(lines, index);
    if (tableResult) {
      children.push(tableResult.node);
      index = tableResult.nextIndex;
      continue;
    }

    const listResult = parseList(lines, index);
    if (listResult) {
      children.push(listResult.node);
      index = listResult.nextIndex;
      continue;
    }

    const calloutMatch = line.match(CALLOUT_RE);
    if (calloutMatch) {
      const variant = calloutMatch[1].toLowerCase();
      const title = calloutMatch[2]?.trim() || undefined;
      const calloutLines = [];
      index += 1;
      while (index < lines.length) {
        const quoted = lines[index].match(/^>\s?(.*)$/);
        if (!quoted) {
          break;
        }
        calloutLines.push(quoted[1]);
        index += 1;
      }
      children.push({
        type: "callout",
        variant,
        title,
        children: linesToBlocks(calloutLines),
      });
      continue;
    }

    if (trimmed.startsWith(">")) {
      const blockquoteResult = parseBlockquote(lines, index);
      children.push(blockquoteResult.node);
      index = blockquoteResult.nextIndex;
      continue;
    }

    const admonitionMatch = line.match(ADMONITION_RE);
    if (admonitionMatch) {
      const block = collectIndentedBlock(lines, index + 1, 4);
      children.push({
        type: "admonition",
        variant: admonitionMatch[3].toLowerCase(),
        title: admonitionMatch[4],
        collapsible: admonitionMatch[1] !== "!!!",
        defaultOpen: Boolean(admonitionMatch[2]),
        children: linesToBlocks(block.lines),
      });
      index = block.nextIndex;
      continue;
    }

    const tabMatch = line.match(TAB_RE);
    if (tabMatch) {
      const items = [];
      while (index < lines.length) {
        const currentTab = lines[index].match(TAB_RE);
        if (!currentTab) {
          break;
        }
        const block = collectIndentedBlock(lines, index + 1, 4);
        items.push({
          type: "tab-item",
          key: createStableId("tab"),
          label: currentTab[1],
          children: linesToBlocks(block.lines),
        });
        index = block.nextIndex;
      }
      children.push({ type: "tabs", items });
      continue;
    }

    const anchorMatch = line.match(ANCHOR_RE);
    if (anchorMatch) {
      const attrs = parseDirectiveAttributes(anchorMatch[1]);
      const id = buildHeadingSlug(attrs.id || "") || createStableId("anchor");
      children.push({ type: "anchor", id });
      index += 1;
      continue;
    }

    if (
      trimmed.startsWith("$$") &&
      trimmed.endsWith("$$") &&
      trimmed.length > 4
    ) {
      children.push({ type: "math-block", value: trimmed.slice(2, -2).trim() });
      index += 1;
      continue;
    }

    const customMatch = line.match(CUSTOM_RE);
    if (customMatch) {
      const attrs = parseDirectiveAttributes(customMatch[1]);
      const { kind, ...data } = attrs;
      children.push({
        type: "custom",
        kind: kind || createStableId("custom"),
        data,
      });
      index += 1;
      continue;
    }

    if (trimmed.startsWith("::image{")) {
      const attrs = parseDirectiveAttributes(
        trimmed.slice("::image{".length, -1),
      );
      children.push({
        type: "image",
        src: attrs.assetId ? `asset://${attrs.assetId}` : "",
        alt: attrs.alt,
        title: attrs.title,
      });
      index += 1;
      continue;
    }

    if (trimmed.match(HTML_START_RE)) {
      const htmlLines = [];
      index += 1;
      while (index < lines.length) {
        const htmlLineMatch = lines[index].match(HTML_LINE_RE);
        if (!htmlLineMatch) {
          break;
        }
        htmlLines.push(htmlLineMatch[1]);
        index += 1;
      }
      children.push({
        type: "custom",
        kind: "html",
        data: { html: htmlLines.join("\n") },
      });
      continue;
    }

    const videoMatch = line.match(VIDEO_RE);
    if (videoMatch) {
      const attrs = parseDirectiveAttributes(videoMatch[1]);
      children.push({
        type: "video",
        src: attrs.assetId ? `asset://${attrs.assetId}` : attrs.src || "",
        title: attrs.title,
        poster: attrs.posterAssetId
          ? `asset://${attrs.posterAssetId}`
          : attrs.poster,
        controls: attrs.controls !== "false",
        muted: attrs.muted === "true",
        loop: attrs.loop === "true",
        autoplay: attrs.autoplay === "true",
      });
      index += 1;
      continue;
    }

    const imageMatch = trimmed.match(IMAGE_RE);
    if (imageMatch) {
      children.push({
        type: "image",
        src: imageMatch[2],
        alt: imageMatch[1],
        title: imageMatch[3],
      });
      index += 1;
      continue;
    }

    if (trimmed.match(LINK_RE)) {
      children.push(createParagraph(trimmed));
      index += 1;
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length && lines[index].trim()) {
      const nextLine = lines[index];
      if (isBlockStarter(nextLine)) {
        break;
      }
      paragraphLines.push(nextLine);
      index += 1;
    }
    children.push(createParagraph(paragraphLines.join("\n")));
  }

  return {
    type: "document",
    version: 1,
    format: "markdown",
    children,
  };
}
