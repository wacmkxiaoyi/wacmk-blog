import { emptyArticleValues } from "./articleEditorModel";

function normalizeScalar(value) {
  const normalized = String(value || "").trim();
  return normalized.length >= 2 &&
    normalized[0] === normalized[normalized.length - 1] &&
    (normalized[0] === '"' || normalized[0] === "'")
    ? normalized.slice(1, -1)
    : normalized;
}

function parseTags(value) {
  const normalized = normalizeScalar(value);
  const items =
    normalized.startsWith("[") && normalized.endsWith("]")
      ? normalized.slice(1, -1)
      : normalized;
  return items.split(",").map(normalizeScalar).filter(Boolean);
}

export function parseMarkdownFrontMatter(markdown) {
  const source = String(markdown || "");
  const lines = source.split(/\r?\n/);
  if (!lines.length || lines[0].trim() !== "---") return [{}, source];

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );
  if (closingIndex === -1) return [{}, source];

  const metadata = {};
  const frontMatterLines = lines.slice(1, closingIndex);
  for (let index = 0; index < frontMatterLines.length;) {
    const line = frontMatterLines[index];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !line.includes(":")) {
      index += 1;
      continue;
    }

    const [rawKey, ...rawValue] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rawValue.join(":").trim();
    if (!["title", "abstract", "tags", "slug"].includes(key)) {
      index += 1;
      continue;
    }

    if (key === "abstract" && (value === "|" || value === ">")) {
      const blockLines = [];
      index += 1;
      while (index < frontMatterLines.length) {
        const nextLine = frontMatterLines[index];
        if (
          nextLine.startsWith(" ") ||
          nextLine.startsWith("\t") ||
          !nextLine.trim()
        ) {
          blockLines.push(nextLine.trimStart());
          index += 1;
        } else break;
      }
      metadata[key] =
        value === "|"
          ? blockLines.join("\n").trim()
          : blockLines
              .filter((part) => part.trim())
              .join(" ")
              .trim();
      continue;
    }

    if (key === "tags" && !value) {
      const tags = [];
      index += 1;
      while (index < frontMatterLines.length) {
        const nextLine = frontMatterLines[index].trim();
        if (!nextLine) {
          index += 1;
          continue;
        }
        if (!nextLine.startsWith("- ")) break;
        const tag = normalizeScalar(nextLine.slice(2));
        if (tag) tags.push(tag);
        index += 1;
      }
      metadata[key] = tags;
      continue;
    }

    metadata[key] = key === "tags" ? parseTags(value) : normalizeScalar(value);
    index += 1;
  }

  return [
    metadata,
    lines
      .slice(closingIndex + 1)
      .join("\n")
      .replace(/^\r?\n+/, ""),
  ];
}

export function extractMarkdownHeadingAndSummary(markdown) {
  let title = "";
  let abstract = [];
  let inCodeBlock = false;

  for (const line of String(markdown || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    if (!title) {
      const heading = line.match(/^\s{0,3}#\s+(.+?)\s*$/);
      if (heading) {
        title = heading[1].trim();
        continue;
      }
    }

    if (abstract.length) {
      if (trimmed) abstract.push(trimmed);
      else break;
      continue;
    }
    if (
      !trimmed ||
      /^\s{0,3}#{1,6}\s+/.test(line) ||
      /^\s{0,3}([-*+]\s+|\d+\.\s+)/.test(line)
    )
      continue;
    abstract = [trimmed];
  }

  return { title, abstract: abstract.join(" ").trim() };
}

function titleFromFilename(fileName) {
  const baseName = String(fileName || "")
    .split(/[\\/]/)
    .pop()
    .replace(/\.[^.]+$/, "")
    .trim();
  return baseName.replace(/[_-]/g, " ");
}

export function parseMarkdownArticle(markdown, fileName, defaultTitle) {
  const [frontMatter, content] = parseMarkdownFrontMatter(markdown);
  const extracted = extractMarkdownHeadingAndSummary(content);
  const title =
    String(frontMatter.title || "").trim() ||
    extracted.title ||
    titleFromFilename(fileName) ||
    defaultTitle;
  const tags = Array.isArray(frontMatter.tags) ? frontMatter.tags : [];

  return {
    ...emptyArticleValues,
    title,
    slug: String(frontMatter.slug || "").trim(),
    abstract: String(frontMatter.abstract || "").trim() || extracted.abstract,
    content,
    tag_names: [...new Set(tags)].join(", "),
  };
}
