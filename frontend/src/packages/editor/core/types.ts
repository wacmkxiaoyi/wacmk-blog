import type { ContentDocument } from "../../content-renderer/core/index.ts";

export type EditorTranslate = (key: string, fallback: string) => string;

export type EditorToolExecutionMode = "visual" | "markdown";

export type EditorToolState = {
  mode: EditorToolExecutionMode;
  markdownMode: boolean;
};

export type EditorToolContext = {
  mode: EditorToolExecutionMode;
  editor: unknown;
  markdownMode: boolean;
  navigationOpen: boolean;
  translate: EditorTranslate;
  openModal: (type: string, payload?: Record<string, unknown>) => void;
  openInlinePanel: (type: "color" | "table") => void;
  openDelimitedTableFilePicker?: () => void;
  openSpreadsheetTableFilePicker?: () => void;
  closeInlinePanel: () => void;
  runVisualCommand: (command: () => boolean | void) => void;
  runVisualInsertCommand: (command: () => boolean | void) => void;
  insertMarkdown: (
    value: string,
    options?: { selectOffset?: number; selectLength?: number },
  ) => void;
  replaceAssetId: (temporaryAssetId: string, assetId: string) => void;
  replaceMarkdownSelection: (
    updater: (selectedText: string) => {
      text: string;
      selectOffset?: number;
      selectLength?: number;
    },
  ) => void;
  setMarkdownMode: (enabled: boolean) => void;
  setNavigationOpen: (enabled: boolean) => void;
  getDocument: () => ContentDocument;
};

export type EditorCustomBlockData = Record<string, unknown>;

export type EditorCustomBlockContextMenuAction = {
  key: string;
  label: string;
  icon?: unknown;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
};

export type EditorCustomBlockContextMenuGroup = {
  group: number;
  children: EditorCustomBlockContextMenuAction[];
};

export type EditorCustomBlockRenderProps = {
  kind: string;
  data: EditorCustomBlockData;
  selected: boolean;
  pos: number;
  editor: unknown;
  updateData: (
    nextData:
      | EditorCustomBlockData
      | ((current: EditorCustomBlockData) => EditorCustomBlockData),
  ) => void;
  updateAttrs: (attrs: Record<string, unknown>) => void;
};

export type EditorCustomBlockContextMenuProps = {
  kind: string;
  data: EditorCustomBlockData;
  pos: number;
  editor: unknown;
  translate: EditorTranslate;
  openModal: (type: string, payload?: Record<string, unknown>) => void;
  updateData: (
    nextData:
      | EditorCustomBlockData
      | ((current: EditorCustomBlockData) => EditorCustomBlockData),
  ) => void;
  updateAttrs: (attrs: Record<string, unknown>) => void;
};

export type EditorCustomBlockDefinition = {
  kind: string;
  data?: EditorCustomBlockData;
  createData?: (context: EditorToolContext) => EditorCustomBlockData;
  render: unknown;
  getContextMenuGroups?: (
    props: EditorCustomBlockContextMenuProps,
  ) => EditorCustomBlockContextMenuGroup[];
};

export type EditorResolvedContextNode = {
  pos: number;
  node: Record<string, any>;
};

export type EditorToolContextMenuContext = {
  toolContext: EditorToolContext;
  target: HTMLElement | null;
  event: MouseEvent;
  contextNode: EditorResolvedContextNode | null;
  updateNodeAttrs: (pos: number, attrs: Record<string, unknown>) => void;
  deleteNode: (pos: number) => void;
};

export type EditorToolDefinition = {
  key: string;
  name: string;
  icon: unknown;
  group: number;
  order?: number;
  keywords?: string[];
  subTools?: string[];
  onClick?: (context: EditorToolContext) => void;
  isActive?: (context: EditorToolContext) => boolean;
  isDisabled?: (context: EditorToolContext) => boolean;
  markdownInsert?: string | ((context: EditorToolContext) => string);
  executeVisual?: (context: EditorToolContext, event?: unknown) => void;
  executeMarkdown?: (context: EditorToolContext, event?: unknown) => void;
  contextNodeTypes?: string[];
  getContextMenuGroups?: (
    context: EditorToolContextMenuContext,
  ) => EditorCustomBlockContextMenuGroup[];
  customBlock?: EditorCustomBlockDefinition;
};

export type RichTextEditorProps = {
  value?: string;
  onChange?: (markdown: string, document: ContentDocument) => void;
  translate?: EditorTranslate;
  className?: string;
  placeholder?: string;
  tools?: EditorToolDefinition[];
  allowFullscreenTool?: boolean;
  resizable?: boolean;
  fillHeight?: boolean;
  minHeight?: number;
  maxHeight?: number;
  initialHeight?: number;
  resolveAssetUrl?: (
    assetId: string,
  ) =>
    | string
    | { url?: string; state?: "uploading" | "failed"; message?: string }
    | undefined;
  assetPreviewVersion?: string | number;
  customBlockVersion?: string | number;
};

export type EditorColorToken =
  "berry" | "rose" | "orange" | "gold" | "green" | "cyan" | "blue" | "purple";

export type EditorCodeLanguage = {
  value: string;
  labelKey: string;
  fallback: string;
};

export type EditorColorTokenOption = {
  token: EditorColorToken;
  labelKey: string;
  fallback: string;
};

export type EditorModalState = {
  type: string;
  payload?: Record<string, unknown>;
} | null;
