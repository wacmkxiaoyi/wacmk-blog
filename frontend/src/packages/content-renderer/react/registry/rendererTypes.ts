import type {
  AdmonitionNode,
  AnchorBlockNode,
  BlockNode,
  BlockquoteNode,
  CalloutNode,
  CodeBlockNode,
  CustomBlockNode,
  HeadingNode,
  HorizontalRuleNode,
  ImageBlockNode,
  InlineCodeNode,
  InlineMathNode,
  InlineNode,
  LineBreakNode,
  LinkNode,
  ListNode,
  MathBlockNode,
  ParagraphNode,
  TableNode,
  TabsNode,
  TextNode,
  VideoBlockNode,
  EmojiNode,
  CheckboxNode,
} from "../../core";
import type React from "react";

export type RendererContextValue = {
  registry: RendererComponentRegistry;
  theme?: Record<string, unknown>;
  resolvers: Record<string, unknown>;
  labels: Record<string, string>;
  options: Record<string, unknown>;
  mode: "article" | "compact" | "preview";
  currentBlockPath?: string;
  document?: {
    equationIdsByPath: Record<string, string>;
    equationNumbersByPath: Record<string, number>;
  };
};

export type BlockRendererProps<T extends BlockNode = BlockNode> = {
  node: T;
  context: RendererContextValue;
};

export type InlineRendererProps<T extends InlineNode = InlineNode> = {
  node: T;
  context: RendererContextValue;
};

export type RendererComponentRegistry = {
  blocks: {
    paragraph: React.ComponentType<BlockRendererProps<ParagraphNode>>;
    heading: React.ComponentType<BlockRendererProps<HeadingNode>>;
    blockquote: React.ComponentType<BlockRendererProps<BlockquoteNode>>;
    list: React.ComponentType<BlockRendererProps<ListNode>>;
    codeBlock: React.ComponentType<BlockRendererProps<CodeBlockNode>>;
    table: React.ComponentType<BlockRendererProps<TableNode>>;
    horizontalRule: React.ComponentType<BlockRendererProps<HorizontalRuleNode>>;
    anchor: React.ComponentType<BlockRendererProps<AnchorBlockNode>>;
    callout: React.ComponentType<BlockRendererProps<CalloutNode>>;
    admonition: React.ComponentType<BlockRendererProps<AdmonitionNode>>;
    tabs: React.ComponentType<BlockRendererProps<TabsNode>>;
    mathBlock: React.ComponentType<BlockRendererProps<MathBlockNode>>;
    image: React.ComponentType<BlockRendererProps<ImageBlockNode>>;
    video: React.ComponentType<BlockRendererProps<VideoBlockNode>>;
    custom: React.ComponentType<BlockRendererProps<CustomBlockNode>>;
  };
  inlines: {
    text: React.ComponentType<InlineRendererProps<TextNode>>;
    link: React.ComponentType<InlineRendererProps<LinkNode>>;
    inlineCode: React.ComponentType<InlineRendererProps<InlineCodeNode>>;
    inlineMath: React.ComponentType<InlineRendererProps<InlineMathNode>>;
    emoji: React.ComponentType<InlineRendererProps<EmojiNode>>;
    checkbox: React.ComponentType<InlineRendererProps<CheckboxNode>>;
    lineBreak: React.ComponentType<InlineRendererProps<LineBreakNode>>;
  };
};

export type CustomRendererProps = BlockRendererProps<CustomBlockNode>;
export type CustomRendererRegistry = Record<
  string,
  React.ComponentType<CustomRendererProps>
>;
