import type React from "react";
import type {
  EditorModalState,
  EditorToolDefinition,
  EditorTranslate,
} from "../../../../core/types.ts";

export type EditorContextMenuPoint = {
  x: number;
  y: number;
};

export type EditorModalType =
  | "link"
  | "link-current-article"
  | "anchor"
  | "image"
  | "video"
  | "html"
  | "inline-math"
  | "math-block"
  | "fullscreen-editor";

export type EditorLinkModalPayload = {
  label?: string;
  href?: string;
  title?: string;
  pos?: number;
};

export type EditorCurrentArticleLinkTarget = {
  id: string;
  text: string;
  level: 1 | 2 | 3;
};

export type EditorCurrentArticleFormulaTarget = {
  id: string;
  text: string;
  number: number;
};

export type EditorCurrentArticleAnchorTarget = {
  id: string;
  text: string;
};

export type EditorCurrentArticleLinkModalPayload = {
  label?: string;
  linkType?: "section" | "formula" | "anchor";
  targetId?: string;
  headingOptions?: EditorCurrentArticleLinkTarget[];
  formulaOptions?: EditorCurrentArticleFormulaTarget[];
  anchorOptions?: EditorCurrentArticleAnchorTarget[];
};

export type EditorAnchorModalPayload = {
  id?: string;
  pos?: number;
};

export type EditorImageModalPayload = {
  alt?: string;
  src?: string;
  title?: string;
  pos?: number;
  indent?: number;
};

export type EditorVideoModalPayload = {
  title?: string;
  src?: string;
  poster?: string;
  caption?: string;
  pos?: number;
  indent?: number;
};

export type EditorFormulaModalPayload = {
  value?: string;
  pos?: number;
};

export type EditorHtmlModalPayload = {
  html?: string;
  pos?: number;
};

export type EditorModalPayloadMap = {
  link: EditorLinkModalPayload;
  "link-current-article": EditorCurrentArticleLinkModalPayload;
  anchor: EditorAnchorModalPayload;
  image: EditorImageModalPayload;
  video: EditorVideoModalPayload;
  html: EditorHtmlModalPayload;
  "inline-math": EditorFormulaModalPayload;
  "math-block": EditorFormulaModalPayload;
  "fullscreen-editor": Record<string, never>;
};

export type EditorTypedModalState = {
  [K in EditorModalType]: {
    type: K;
    payload?: EditorModalPayloadMap[K];
  };
}[EditorModalType];

export type RichTextEditorModalState = EditorModalState & EditorTypedModalState;

export type EditorModalFormState = {
  label: string;
  url: string;
  formula: string;
  html: string;
  anchorName: string;
  linkType: "section" | "formula" | "anchor";
  targetId: string;
};

export type EditorLabels = {
  copy: string;
  copied: string;
  expand: string;
  collapse: string;
  permalink: string;
};

export type EditorLabelsRef = React.MutableRefObject<EditorLabels>;

export type CustomBlockRegistryRef = React.MutableRefObject<
  Record<string, EditorToolDefinition>
>;

export type EditorBridgeMenuGroup = {
  group: number;
  children: Array<Record<string, unknown>>;
};

export type RichTextEditorBridge = {
  openModal: <T extends EditorModalType>(
    type: T,
    payload?: EditorModalPayloadMap[T],
  ) => void;
  openContextMenu: (
    point: EditorContextMenuPoint,
    groups: EditorBridgeMenuGroup[],
  ) => void;
  translate: EditorTranslate;
  resolveAssetUrl: (
    assetId: string,
  ) =>
    | string
    | { url?: string; state?: "uploading" | "failed"; message?: string }
    | undefined;
  getAssetPreviewVersion: () => string | number;
  subscribeAssetPreview: (listener: () => void) => () => void;
  getCustomBlockVersion: () => string | number;
  subscribeCustomBlock: (listener: () => void) => () => void;
};

export type RichTextEditorBridgeRef =
  React.MutableRefObject<RichTextEditorBridge>;

export type CreateRichTextEditorExtensionsArgs = {
  labelsRef: EditorLabelsRef;
  bridgeRef: RichTextEditorBridgeRef;
  customBlockRegistryRef: CustomBlockRegistryRef;
};

export type IndentAttrs = {
  indent?: number;
};

export type ColorTokenAttrs = {
  token?: string | null;
};

export type InlineMathAttrs = {
  value?: string;
};

export type MathBlockAttrs = InlineMathAttrs & IndentAttrs;

export type AdmonitionBlockAttrs = IndentAttrs & {
  variant?: string;
  title?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
};

export type TabItemAttrs = {
  key?: string;
  label?: string;
};

export type TabsBlockAttrs = IndentAttrs;

export type ImageBlockAttrs = IndentAttrs & {
  src?: string;
  alt?: string;
  title?: string;
};

export type VideoBlockAttrs = IndentAttrs & {
  src?: string;
  title?: string;
  poster?: string;
  caption?: string;
};

export type CustomBlockAttrs = IndentAttrs & {
  kind?: string;
  data?: Record<string, unknown>;
};
