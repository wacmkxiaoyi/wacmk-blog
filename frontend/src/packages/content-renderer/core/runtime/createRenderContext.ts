const DEFAULT_LABELS = {
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Copy failed",
  expand: "Show more",
  collapse: "Show less",
  download: "Download",
  preview: "Preview",
  permalink: "Copy heading link",
};

const DEFAULT_OPTIONS = {
  enableCodeCopy: true,
  enableCodeCollapse: true,
  enableHeadingAnchor: true,
  enableTableOverflow: true,
  maxCodeLines: 12,
  maxTableRows: 6,
};

export function createRenderContext({
  registry,
  theme,
  resolvers,
  labels,
  options,
  mode = "article",
  customComponents,
  resolveCustomComponent,
  anchors,
  document,
}) {
  return {
    registry,
    theme,
    resolvers: resolvers || {},
    labels: { ...DEFAULT_LABELS, ...(labels || {}) },
    options: { ...DEFAULT_OPTIONS, ...(options || {}) },
    anchors: anchors || null,
    mode,
    document: document || { equationIdsByPath: {}, equationNumbersByPath: {} },
    customComponents: customComponents || {},
    resolveCustomComponent,
  };
}
