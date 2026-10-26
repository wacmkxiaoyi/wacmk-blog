import type { LinkMeta, NodeMeta } from "./meta";
import type { TextMark } from "./marks";

export type TextNode = {
  type: "text";
  value: string;
  marks?: TextMark[];
  meta?: NodeMeta;
};

export type LinkNode = {
  type: "link";
  href: string;
  title?: string;
  children: InlineNode[];
  meta?: LinkMeta;
};

export type InlineCodeNode = {
  type: "inline-code";
  value: string;
  meta?: NodeMeta;
};

export type InlineMathNode = {
  type: "inline-math";
  value: string;
  meta?: NodeMeta;
};

export type EmojiNode = {
  type: "emoji";
  value: string;
  shortcode?: string;
  meta?: NodeMeta;
};

export type CheckboxNode = {
  type: "checkbox";
  checked: boolean;
  meta?: NodeMeta;
};

export type LineBreakNode = {
  type: "line-break";
  meta?: NodeMeta;
};

export type InlineNode =
  | TextNode
  | LinkNode
  | InlineCodeNode
  | InlineMathNode
  | EmojiNode
  | CheckboxNode
  | LineBreakNode;
