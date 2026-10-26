import { Mark, mergeAttributes } from "@tiptap/core";

export function createColorTokenMark() {
  return Mark.create({
    name: "colorToken",
    addAttributes() {
      return {
        token: {
          default: null,
        },
      };
    },
    parseHTML() {
      return [{ tag: "span[data-color-token]" }];
    },
    renderHTML({ HTMLAttributes }) {
      const token = HTMLAttributes.token || "purple";
      return [
        "span",
        mergeAttributes(HTMLAttributes, {
          "data-color-token": token,
          class: `cr-text-color cr-text-color-${token}`,
        }),
        0,
      ];
    },
    addCommands() {
      return {
        setColorToken:
          (token: string) =>
          ({ chain }) =>
            chain().setMark(this.name, { token }).run(),
        unsetColorToken:
          () =>
          ({ chain }) =>
            chain().unsetMark(this.name).run(),
      };
    },
  });
}
