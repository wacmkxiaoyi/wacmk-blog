import React from "react";
import {
  NodeViewContent,
  ReactNodeViewRenderer,
  NodeViewWrapper,
} from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import CodeBlock from "@tiptap/extension-code-block";
import Prism from "prismjs";
import { CopyButton } from "../../../../../../content-renderer/react/renderers/shared/CopyButton.tsx";
import type { EditorLabelsRef } from "../../helpers/types.ts";
import styles from "../../RichTextEditor.module.css";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getCodeGrammar(language) {
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

export function createCodeBlockNode(labelsRef: EditorLabelsRef) {
  function CodeBlockView(props) {
    const language = String(props.node.attrs.language || "text");
    const value = String(props.node.textContent || "");
    const grammar = React.useMemo(() => getCodeGrammar(language), [language]);
    const highlightedLines = React.useMemo(() => {
      return value.split(/\r?\n/).map((line) => {
        if (!grammar) {
          return { __html: escapeHtml(line || " ") };
        }

        return {
          __html: Prism.highlight(line || " ", grammar.grammar, grammar.key),
        };
      });
    }, [grammar, value]);

    return (
      <NodeViewWrapper
        as="div"
        className={styles.codeBlockNode}
        data-editor-node-type="codeBlock"
        onContextMenu={() =>
          props.editor.commands.setNodeSelection(props.getPos())
        }
      >
        <div className="cr-code-block">
          <CopyButton value={value} labels={labelsRef.current} />
          <div className={styles.codeBlockEditorShell}>
            <pre className={styles.codeBlockPre}>
              <div className={styles.codeBlockLayout}>
                <div className={styles.codeBlockCanvas}>
                  <code
                    aria-hidden="true"
                    className={[
                      styles.codeBlockMirror,
                      "cr-code-layout",
                      language ? `language-${language}` : null,
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
                  <code
                    className={[
                      styles.codeBlockContent,
                      "cr-code-layout",
                      language ? `language-${language}` : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <NodeViewContent
                      as="div"
                      className={styles.codeBlockContentEditable}
                    />
                  </code>
                </div>
              </div>
            </pre>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  return CodeBlock.extend({
    addAttributes() {
      return {
        ...(this.parent?.() || {}),
        indent: {
          default: 0,
          renderHTML: (attributes) =>
            attributes.indent ? { "data-indent-level": attributes.indent } : {},
        },
      };
    },
    addNodeView() {
      return ReactNodeViewRenderer(CodeBlockView);
    },
    addKeyboardShortcuts() {
      return {
        Enter: () => {
          const { state } = this.editor;
          const { selection } = state;
          const { $from, empty } = selection;

          if (!empty || $from.parent.type !== this.type) {
            return false;
          }

          return this.editor.commands.command(({ tr, dispatch }) => {
            tr.insertText("\n", selection.from, selection.to);
            tr.setSelection(
              TextSelection.near(tr.doc.resolve(selection.from + 1)),
            );
            dispatch?.(tr);
            return true;
          });
        },
      };
    },
  });
}
