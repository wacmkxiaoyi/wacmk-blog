import type {
  CodeBlockMeta,
  HeadingMeta,
  MediaMeta,
  NodeMeta,
  TableMeta,
} from "./meta";
import type { InlineNode } from "./inlines";

export type ParagraphNode = {
  type: "paragraph";
  children: InlineNode[];
  meta?: NodeMeta;
};

export type HeadingNode = {
  type: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  id?: string;
  children: InlineNode[];
  meta?: HeadingMeta;
};

export type BlockquoteNode = {
  type: "blockquote";
  children: BlockNode[];
  meta?: NodeMeta;
};

export type ListItemNode = {
  type: "list-item";
  checked?: boolean | null;
  children: BlockNode[];
  meta?: NodeMeta;
};

export type ListNode = {
  type: "list";
  ordered: boolean;
  start?: number;
  tight?: boolean;
  items: ListItemNode[];
  meta?: NodeMeta;
};

export type CodeBlockNode = {
  type: "code-block";
  value: string;
  language?: string;
  filename?: string;
  highlightLines?: number[];
  collapsed?: boolean;
  meta?: CodeBlockMeta;
};

export type TableCellNode = {
  type: "table-cell";
  header?: boolean;
  align?: "left" | "center" | "right" | null;
  children: BlockNode[];
};

export type TableRowNode = {
  type: "table-row";
  cells: TableCellNode[];
};

export type TableNode = {
  type: "table";
  align?: Array<"left" | "center" | "right" | null>;
  head?: TableRowNode;
  body: TableRowNode[];
  meta?: TableMeta;
};

export type HorizontalRuleNode = {
  type: "horizontal-rule";
  meta?: NodeMeta;
};

export type AnchorBlockNode = {
  type: "anchor";
  id: string;
  meta?: NodeMeta;
};

export type CalloutVariant =
  "note" | "tip" | "important" | "caution" | "warning";

export type CalloutNode = {
  type: "callout";
  variant: CalloutVariant;
  title?: string;
  children: BlockNode[];
  meta?: NodeMeta;
};

export type AdmonitionVariant = "note" | "tip" | "warning" | "error";

export type AdmonitionNode = {
  type: "admonition";
  variant: AdmonitionVariant;
  title?: string;
  collapsible: boolean;
  defaultOpen: boolean;
  children: BlockNode[];
  meta?: NodeMeta;
};

export type TabItemNode = {
  type: "tab-item";
  key: string;
  label: string;
  children: BlockNode[];
};

export type TabsNode = {
  type: "tabs";
  items: TabItemNode[];
  meta?: NodeMeta & { lazy?: boolean };
};

export type MathBlockNode = {
  type: "math-block";
  value: string;
  meta?: NodeMeta;
};

export type ImageBlockNode = {
  type: "image";
  src: string;
  alt?: string;
  title?: string;
  caption?: InlineNode[];
  width?: number;
  height?: number;
  meta?: MediaMeta;
};

export type VideoBlockNode = {
  type: "video";
  src: string;
  title?: string;
  poster?: string;
  caption?: InlineNode[];
  width?: number;
  height?: number;
  controls?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  meta?: MediaMeta;
};

export type CustomBlockNode = {
  type: "custom";
  kind: string;
  data?: Record<string, unknown>;
  caption?: InlineNode[];
  meta?: MediaMeta;
};

export type BlockNode =
  | ParagraphNode
  | HeadingNode
  | BlockquoteNode
  | ListNode
  | CodeBlockNode
  | TableNode
  | HorizontalRuleNode
  | AnchorBlockNode
  | CalloutNode
  | AdmonitionNode
  | TabsNode
  | MathBlockNode
  | ImageBlockNode
  | VideoBlockNode
  | CustomBlockNode;
