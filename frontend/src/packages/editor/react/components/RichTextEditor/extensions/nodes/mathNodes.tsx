import React from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import katex from "katex";
import { EditIcon } from "../../../../icons/index.ts";
import type { RichTextEditorBridgeRef } from "../../helpers/types.ts";
import { getEditorEquationMeta } from "../../helpers/equations.ts";
import styles from "../../RichTextEditor.module.css";
import {
  buildBlockContextMenuGroups,
  createEditorBlockNode,
  renderNodeTag,
} from "../shared.tsx";

function renderKatex(value, displayMode) {
  try {
    return katex.renderToString(value, { displayMode, throwOnError: false });
  } catch (_error) {
    return null;
  }
}

export function createInlineMathNode(bridgeRef: RichTextEditorBridgeRef) {
  function InlineMathView(props) {
    const formula = String(props.node.attrs.value || "");
    const html = renderKatex(formula, false);

    function handleContextMenu(event) {
      event.preventDefault();
      event.stopPropagation();
      props.editor.commands.setNodeSelection(props.getPos());
      bridgeRef.current.openContextMenu(
        { x: event.clientX, y: event.clientY },
        [
          {
            group: 0,
            children: [
              {
                key: "edit-inline-formula",
                label: bridgeRef.current.translate(
                  "editor.context.editFormula",
                  "Edit formula",
                ),
                icon: <EditIcon />,
                onClick: () =>
                  bridgeRef.current.openModal("inline-math", {
                    pos: props.getPos(),
                    value: formula,
                  }),
              },
            ],
          },
        ],
      );
    }

    return (
      <NodeViewWrapper
        as="span"
        data-editor-node-type="inlineMath"
        className={styles.inlineMathNode}
        onDoubleClick={() =>
          bridgeRef.current.openModal("inline-math", {
            pos: props.getPos(),
            value: formula,
          })
        }
        onContextMenu={handleContextMenu}
      >
        {html ? (
          <span
            className="cr-inline-math"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <span className="cr-inline-math">{formula}</span>
        )}
      </NodeViewWrapper>
    );
  }

  return Node.create({
    name: "inlineMath",
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,
    addAttributes() {
      return { value: { default: "" } };
    },
    parseHTML() {
      return [{ tag: "span[data-editor-node='inline-math']" }];
    },
    renderHTML({ HTMLAttributes }) {
      return renderNodeTag("span", HTMLAttributes, "inline-math");
    },
    addNodeView() {
      return ReactNodeViewRenderer(InlineMathView);
    },
    addCommands() {
      return {
        setInlineMath:
          (value: string) =>
          ({ chain }) =>
            chain().insertContent({ type: this.name, attrs: { value } }).run(),
      };
    },
  });
}

export function createMathBlockNode(bridgeRef: RichTextEditorBridgeRef) {
  function MathBlockView(props) {
    const formula = String(props.node.attrs.value || "");
    const html = renderKatex(formula, true);
    const equationMeta = React.useMemo(
      () => getEditorEquationMeta(props.editor, props.getPos()),
      [props.editor, props.getPos, props.node.attrs.value],
    );

    function handleContextMenu(event) {
      event.preventDefault();
      event.stopPropagation();
      props.editor.commands.setNodeSelection(props.getPos());
      bridgeRef.current.openContextMenu(
        { x: event.clientX, y: event.clientY },
        [
          ...buildBlockContextMenuGroups(
            props.editor,
            bridgeRef.current.translate,
          ),
          {
            group: 1,
            children: [
              {
                key: "edit-math-block",
                label: bridgeRef.current.translate(
                  "editor.context.editFormula",
                  "Edit formula",
                ),
                icon: <EditIcon />,
                onClick: () =>
                  bridgeRef.current.openModal("math-block", {
                    pos: props.getPos(),
                    value: formula,
                  }),
              },
            ],
          },
        ],
      );
    }

    return (
      <NodeViewWrapper
        as="div"
        data-editor-node-type="mathBlock"
        className={styles.blockNodeShell}
        style={{ marginLeft: `${Number(props.node.attrs.indent || 0) * 2}rem` }}
        onDoubleClick={() =>
          bridgeRef.current.openModal("math-block", {
            pos: props.getPos(),
            value: formula,
          })
        }
        onContextMenu={handleContextMenu}
      >
        <div
          className="cr-math-block-shell"
          id={equationMeta?.id}
          data-content-anchor-id={equationMeta?.id}
        >
          <div className="cr-math-block">
            {html ? (
              <div
                className="cr-math-block-content"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <pre className="cr-math-block-content cr-math-block-content--fallback">
                {formula}
              </pre>
            )}
            {equationMeta?.number ? (
              <span className="cr-math-block-number">
                ({equationMeta.number})
              </span>
            ) : null}
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  return createEditorBlockNode("mathBlock", {
    group: "block",
    atom: true,
    selectable: true,
    addAttributes() {
      return { value: { default: "" }, indent: { default: 0 } };
    },
    parseHTML() {
      return [{ tag: "div[data-editor-node='math-block']" }];
    },
    renderHTML({ HTMLAttributes }) {
      return renderNodeTag("div", HTMLAttributes, "math-block");
    },
    addNodeView() {
      return ReactNodeViewRenderer(MathBlockView);
    },
    addCommands() {
      return {
        setMathBlock:
          (value: string) =>
          ({ chain }) =>
            chain().insertContent({ type: this.name, attrs: { value } }).run(),
      };
    },
  });
}
