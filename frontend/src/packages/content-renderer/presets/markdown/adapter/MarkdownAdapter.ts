import { markdownToNodes } from "./markdownToNodes";

export const MarkdownAdapter = {
  format: "markdown",
  parse(input) {
    return markdownToNodes(String(input || ""));
  },
};
