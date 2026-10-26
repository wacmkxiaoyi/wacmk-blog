export function formatTabLabel(label = "Tab {index}", index = 1) {
  return label.replace(/\{index\}/gi, String(index));
}

export function createDefaultTab(index = 1, label = "Tab {index}") {
  return {
    key: `tab-${Date.now()}-${index}`,
    label: formatTabLabel(label, index),
  };
}

export function createDefaultTabsBlockContent(label = "Tab {index}") {
  return [
    {
      type: "tabItem",
      attrs: createDefaultTab(1, label),
      content: [{ type: "paragraph" }],
    },
  ];
}

export function createDefaultAdmonitionBlockAttrs() {
  return {
    variant: "note",
    title: "",
    collapsible: false,
    defaultOpen: true,
    indent: 0,
  };
}
