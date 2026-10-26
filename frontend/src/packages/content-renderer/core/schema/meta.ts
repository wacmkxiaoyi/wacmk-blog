export type ContentFormat = "markdown" | "rich-text" | "html";

export type SourceMapInfo = {
  line?: number;
  column?: number;
  offset?: number;
};

export type NodeMeta = {
  source?: SourceMapInfo;
  annotations?: Record<string, unknown>;
  extra?: Record<string, unknown>;
};

export type DocumentMeta = {
  title?: string;
  description?: string;
  language?: string;
  direction?: "ltr" | "rtl";
  source?: string;
  generatedAt?: string;
  extensions?: string[];
  extra?: Record<string, unknown>;
};

export type HeadingMeta = NodeMeta & {
  anchorable?: boolean;
  tocIncluded?: boolean;
  sourceSlug?: string;
};

export type CodeBlockMeta = NodeMeta & {
  rawFence?: string;
  title?: string;
  showLineNumbers?: boolean;
};

export type TableMeta = NodeMeta & {
  overflow?: "scroll" | "wrap" | "collapse";
};

export type MediaMeta = NodeMeta & {
  sourceType?: "upload" | "external";
  access?: "public" | "private" | "restricted";
};

export type AttachmentMeta = MediaMeta & {
  downloadable?: boolean;
  previewable?: boolean;
};

export type LinkMeta = NodeMeta & {
  kind?: "internal" | "external" | "anchor" | "media";
  targetType?: string;
  openInNewTab?: boolean;
  noFollow?: boolean;
};
