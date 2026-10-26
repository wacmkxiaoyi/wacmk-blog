import type { EditorTranslate } from "../../../../core/types.ts";

export function formatEquationLabel(
  translate: EditorTranslate,
  number: number,
) {
  return `${translate("editor.field.equation", "Equation")} ${number}`;
}

export function extractEquationTargets(document, translate: EditorTranslate) {
  const items: Array<{ id: string; text: string; number: number }> = [];

  function visitBlocks(nodes) {
    for (const node of Array.isArray(nodes) ? nodes : []) {
      if (!node) {
        continue;
      }

      if (node.type === "math-block") {
        const number = items.length + 1;
        items.push({
          id: `equation-${number}`,
          text: formatEquationLabel(translate, number),
          number,
        });
      }

      if (Array.isArray(node.children)) {
        visitBlocks(node.children);
      }

      if (Array.isArray(node.items)) {
        for (const item of node.items) {
          visitBlocks(item?.children);
        }
      }
    }
  }

  visitBlocks(document?.children || []);
  return items;
}

export function getEditorEquationMeta(editor, position: number) {
  if (!editor?.state?.doc || typeof position !== "number") {
    return null;
  }

  let equationNumber = 0;
  let match = null;
  editor.state.doc.descendants((node, nodePos) => {
    if (node?.type?.name !== "mathBlock") {
      return true;
    }

    equationNumber += 1;
    if (nodePos === position) {
      match = {
        id: `equation-${equationNumber}`,
        number: equationNumber,
      };
    }

    return true;
  });

  return match;
}
