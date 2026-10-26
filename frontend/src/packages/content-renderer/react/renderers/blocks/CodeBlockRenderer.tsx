import React from "react";
import Prism from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-python";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import { CopyButton } from "../shared";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getGrammar(language) {
  if (!language) {
    return null;
  }

  const normalized = String(language).toLowerCase();
  const aliases = {
    js: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    ts: "typescript",
    html: "markup",
    xml: "markup",
    svg: "markup",
    md: "markdown",
    yml: "yaml",
    shell: "bash",
    sh: "bash",
    py: "python",
    cc: "cpp",
    cxx: "cpp",
    hpp: "cpp",
    h: "c",
  };
  const key = aliases[normalized] || normalized;
  const grammar = Prism.languages[key];

  if (!grammar) {
    return null;
  }

  return { key, grammar };
}

export function CodeBlockRenderer({ node, context }) {
  const lines = node.value.split(/\r?\n/);
  const maxCodeLines = Number(context.options.maxCodeLines || 12);
  const collapsible =
    context.options.enableCodeCollapse !== false && lines.length > maxCodeLines;
  const canCopy = context.options.enableCodeCopy !== false;
  const [expanded, setExpanded] = React.useState(!collapsible);
  const grammar = React.useMemo(
    () => getGrammar(node.language),
    [node.language],
  );
  const highlightedLines = React.useMemo(() => {
    return lines.map((line) => {
      if (!grammar) {
        return { __html: escapeHtml(line || " ") };
      }

      return {
        __html: Prism.highlight(line || " ", grammar.grammar, grammar.key),
      };
    });
  }, [grammar, lines]);

  React.useEffect(() => {
    setExpanded(!collapsible);
  }, [collapsible, node.value]);

  const hiddenCount = Math.max(0, lines.length - maxCodeLines);

  return (
    <div className="cr-code-block">
      {canCopy ? (
        <CopyButton value={node.value} labels={context.labels} />
      ) : null}
      <pre
        className={
          collapsible && !expanded
            ? "is-collapsed is-code-collapsed"
            : undefined
        }
        style={
          collapsible && !expanded
            ? { "--code-visible-lines": maxCodeLines }
            : undefined
        }
      >
        <code
          className={[
            "cr-code-layout",
            node.language ? `language-${node.language}` : null,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {highlightedLines.map((line, index) => (
            <span key={`line-${index + 1}`} className="cr-code-line">
              <span className="cr-code-line-number">{index + 1}</span>
              <span
                className="cr-code-line-content"
                dangerouslySetInnerHTML={line}
              />
            </span>
          ))}
        </code>
        {collapsible && !expanded ? (
          <div className="cr-overflow-overlay">
            <div className="cr-overflow-hint">
              Hidden {hiddenCount} more lines
            </div>
            <button
              type="button"
              className="cr-overflow-button cr-code-overflow-button"
              onClick={() => setExpanded(true)}
            >
              {context.labels.expand}
            </button>
          </div>
        ) : null}
      </pre>
    </div>
  );
}
