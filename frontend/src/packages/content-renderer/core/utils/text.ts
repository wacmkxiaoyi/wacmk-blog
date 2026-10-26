export function plainTextFromInlines(inlines) {
  return (inlines || [])
    .map((node) => {
      if (!node) {
        return "";
      }
      if (node.type === "text") {
        return node.value;
      }
      if (node.type === "emoji") {
        return node.value;
      }
      if (node.type === "checkbox") {
        return "";
      }
      if (node.type === "link") {
        return plainTextFromInlines(node.children);
      }
      if (node.type === "inline-code" || node.type === "inline-math") {
        return node.value;
      }
      return "";
    })
    .join("");
}
