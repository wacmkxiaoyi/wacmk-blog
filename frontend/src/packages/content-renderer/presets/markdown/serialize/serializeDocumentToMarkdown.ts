function repeat(value, count) {
  return new Array(count + 1).join(value);
}

function escapePipeText(value) {
  return String(value || "").replace(/\|/g, "\\|");
}

function trimTrailingWhitespace(value) {
  return String(value || "")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

function normalizeVariant(value, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized || fallback;
}

function serializeDirectiveAttributes(attributes) {
  return Object.entries(attributes)
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    )
    .map(([key, value]) => `${key}="${String(value).replace(/"/g, '\\"')}"`)
    .join(" ");
}

function serializeMarkOpen(mark) {
  switch (mark.type) {
    case "bold":
      return "**";
    case "italic":
      return "*";
    case "strike":
      return "~~";
    case "underline":
      return "++";
    default:
      return "";
  }
}

function serializeMarkClose(mark) {
  return serializeMarkOpen(mark);
}

function createSerializerApi(registry = {}) {
  function serializeInlineNode(node) {
    if (!node) {
      return "";
    }

    switch (node.type) {
      case "text": {
        const marks = Array.isArray(node.marks) ? node.marks : [];
        const colorMarks = marks.filter((mark) => mark?.type === "color");
        const wrapperMarks = marks.filter(
          (mark) => mark?.type !== "color" && mark?.type !== "highlight",
        );
        let content = String(node.value || "");

        if (colorMarks.length) {
          const colorMark = colorMarks[colorMarks.length - 1];
          content = `[${content}]{.md-color-${colorMark.value}}`;
        }

        if (wrapperMarks.length) {
          content = wrapperMarks.reduceRight((current, mark) => {
            return `${serializeMarkOpen(mark)}${current}${serializeMarkClose(mark)}`;
          }, content);
        }

        return content;
      }
      case "link":
        return `[${serializeInlineNodes(node.children)}](${node.href}${node.title ? ` \"${node.title}\"` : ""})`;
      case "inline-code":
        return `\`${node.value || ""}\``;
      case "inline-math":
        return `$${String(node.value || "").replace(/\$/g, "\\$")}$`;
      case "emoji":
        return node.value || "";
      case "checkbox":
        return node.checked ? "[x]" : "[]";
      case "line-break":
        return "  \n";
      default:
        return "";
    }
  }

  function serializeInlineNodes(nodes) {
    return (nodes || []).map(serializeInlineNode).join("");
  }

  function indentBlock(value, spaces = 4) {
    const prefix = repeat(" ", spaces);
    return String(value || "")
      .split("\n")
      .map((line) => (line ? `${prefix}${line}` : ""))
      .join("\n");
  }

  function stringifyParagraphLines(children) {
    return serializeInlineNodes(children).split("\n");
  }

  function serializeListItem(item, itemIndex, ordered, indentLevel = 0) {
    const marker = ordered ? `${itemIndex + 1}. ` : "- ";
    const indent = repeat(" ", indentLevel * 2);
    const taskMarker =
      item.checked == null ? "" : item.checked ? "[x] " : "[ ] ";
    const firstLinePrefix = `${indent}${marker}${taskMarker}`;
    const continuationIndent = `${indent}${repeat(" ", marker.length)}`;
    const blocks = Array.isArray(item.children) ? item.children : [];
    if (!blocks.length) {
      return firstLinePrefix.trimEnd();
    }

    const [firstBlock, ...restBlocks] = blocks;
    let firstBlockMarkdown = serializeBlockNode(firstBlock, {
      indentLevel: indentLevel + 1,
    });
    if (firstBlock?.type === "paragraph") {
      const lines = stringifyParagraphLines(firstBlock.children);
      firstBlockMarkdown = lines
        .map((line, index) => {
          return `${index === 0 ? firstLinePrefix : continuationIndent}${line}`;
        })
        .join("\n");
    } else {
      firstBlockMarkdown = `${firstLinePrefix.trimEnd()}${firstBlockMarkdown ? "\n" : ""}${indentBlock(firstBlockMarkdown, marker.length)}`;
    }

    const restMarkdown = restBlocks
      .map((block) =>
        indentBlock(
          serializeBlockNode(block, { indentLevel: indentLevel + 1 }),
          marker.length,
        ),
      )
      .filter(Boolean)
      .join("\n\n");

    return [firstBlockMarkdown, restMarkdown].filter(Boolean).join("\n\n");
  }

  function serializeTable(node) {
    const rows = [];
    const head = node.head?.cells || [];
    const body = Array.isArray(node.body) ? node.body : [];
    const align = Array.isArray(node.align) ? node.align : [];

    if (head.length) {
      rows.push(
        `| ${head.map((cell) => escapePipeText(serializeBlockNodes(cell.children, { joiner: " " }))).join(" | ")} |`,
      );
      rows.push(
        `| ${head
          .map((_cell, index) => {
            const currentAlign = align[index];
            if (currentAlign === "left") return ":---";
            if (currentAlign === "center") return ":---:";
            if (currentAlign === "right") return "---:";
            return "---";
          })
          .join(" | ")} |`,
      );
    }

    body.forEach((row) => {
      rows.push(
        `| ${row.cells.map((cell) => escapePipeText(serializeBlockNodes(cell.children, { joiner: " " }))).join(" | ")} |`,
      );
    });

    return rows.join("\n");
  }

  function serializeAdmonition(node) {
    const marker =
      node.collapsible === false ? "!!!" : `???${node.defaultOpen ? "+" : ""}`;
    const title = node.title ? ` \"${node.title}\"` : "";
    const body = serializeBlockNodes(node.children);
    return `${marker} ${normalizeVariant(node.variant, "note")}${title}\n${indentBlock(body, 4)}`;
  }

  function serializeTabs(node) {
    return (node.items || [])
      .map((item) => {
        const body = serializeBlockNodes(item.children);
        return `=== \"${item.label}\"\n${indentBlock(body, 4)}`;
      })
      .join("\n\n");
  }

  const defaultBlockSerializers = {
    paragraph: (node) => serializeInlineNodes(node.children),
    heading: (node) =>
      `${repeat("#", node.level || 1)} ${serializeInlineNodes(node.children)}`,
    blockquote: (node) => {
      const content = serializeBlockNodes(node.children);
      return content
        .split("\n")
        .map((line) => `> ${line}`.trimEnd())
        .join("\n");
    },
    list: (node, options = {}) =>
      (node.items || [])
        .map((item, index) => {
          return serializeListItem(
            item,
            index + ((node.start || 1) - 1),
            Boolean(node.ordered),
            options.indentLevel || 0,
          );
        })
        .join("\n"),
    "code-block": (node) =>
      `\`\`\`${node.language || ""}\n${node.value || ""}\n\`\`\``,
    table: (node) => serializeTable(node),
    "horizontal-rule": () => "---",
    anchor: (node) =>
      `::anchor{${serializeDirectiveAttributes({ id: node.id })}}`,
    callout: (node) => {
      const body = serializeBlockNodes(node.children);
      const lines = body.split("\n");
      const heading = `> [!${normalizeVariant(node.variant, "note").toUpperCase()}]${node.title ? ` ${node.title}` : ""}`;
      return [heading]
        .concat(lines.map((line) => `> ${line}`.trimEnd()))
        .join("\n");
    },
    admonition: (node) => serializeAdmonition(node),
    tabs: (node) => serializeTabs(node),
    "math-block": (node) => `$$\n${node.value || ""}\n$$`,
    image: (node) =>
      String(node.src || "").startsWith("asset://")
        ? `::image{${serializeDirectiveAttributes({ assetId: String(node.src).slice("asset://".length), alt: node.alt, title: node.title })}}`
        : `![${node.alt || ""}](${node.src || ""}${node.title ? ` \"${node.title}\"` : ""})`,
    video: (node) =>
      `::video{${serializeDirectiveAttributes({
        ...(String(node.src || "").startsWith("asset://")
          ? { assetId: String(node.src).slice("asset://".length) }
          : { src: node.src }),
        title: node.title,
        ...(String(node.poster || "").startsWith("asset://")
          ? { posterAssetId: String(node.poster).slice("asset://".length) }
          : { poster: node.poster }),
        controls: node.controls === false ? "false" : undefined,
        muted: node.muted ? "true" : undefined,
        loop: node.loop ? "true" : undefined,
        autoplay: node.autoplay ? "true" : undefined,
      })}}`,
    custom: (node) => {
      if (node.kind === "html") {
        const html = String(node.data?.html || "").replace(/\r\n?/g, "\n");
        return ["::html", ...html.split("\n").map((line) => `:: ${line}`)].join(
          "\n",
        );
      }
      return `::custom{${serializeDirectiveAttributes({
        kind: node.kind,
        ...(node.data || {}),
      })}}`;
    },
  };

  function serializeBlockNode(node, options = {}) {
    if (!node) {
      return "";
    }

    const registration = registry?.[node.type];
    if (typeof registration?.serialize === "function") {
      return registration.serialize(node, {
        serializeBlockNodes,
        serializeInlineNodes,
        serializeDirectiveAttributes,
        indentBlock,
        options,
      });
    }

    const serializer = defaultBlockSerializers[node.type];
    return typeof serializer === "function" ? serializer(node, options) : "";
  }

  function serializeBlockNodes(nodes, options = {}) {
    const joiner = options.joiner || "\n\n";
    return (nodes || [])
      .map((node) => serializeBlockNode(node, options))
      .filter(Boolean)
      .join(joiner);
  }

  return {
    serializeInlineNode,
    serializeInlineNodes,
    serializeBlockNode,
    serializeBlockNodes,
    serializeDirectiveAttributes,
    indentBlock,
  };
}

export function serializeDocumentToMarkdown(document, registry) {
  if (!document || document.type !== "document") {
    return "";
  }

  const api = createSerializerApi(registry);
  return trimTrailingWhitespace(
    api.serializeBlockNodes(document.children || []),
  );
}
