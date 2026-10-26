import type { ReactNode } from "react";
import type { ContextActionGroup } from "../../context-actions/core/index.ts";

export type CatalogGroup = {
  _kind: "catalog-group";
  _key: string;
  title: string;
  children: CatalogItem[];
};

export type CatalogItem = CatalogGroup | Record<string, unknown>;

export type Path = number[];

export type CatalogTranslate = (key: string, fallback: string) => string;

export type CatalogToolContext = {
  items: CatalogItem[];
  setItems: (items: CatalogItem[]) => void;
};

export type CatalogToolDefinition = {
  key: string;
  name: string;
  icon: ReactNode;
  group?: number;
  order?: number;
  onClick?: (ctx: CatalogToolContext) => void;
  isVisible?: (ctx: CatalogToolContext) => boolean;
  isDisabled?: (ctx: CatalogToolContext) => boolean;
  getContextMenuGroups?: (
    ctx: CatalogToolContext,
    node: CatalogItem,
    path: Path,
  ) => ContextActionGroup[];
};

export type CatalogManagerLabels = {
  toolbarAddGroup?: string;
  addGroupModalTitle?: string;
  addGroupModalPlaceholder?: string;
  addGroupModalConfirm?: string;
  addGroupModalCancel?: string;
  moveUp?: string;
  moveDown?: string;
  rename?: string;
  delete?: string;
  renameModalTitle?: string;
  renameModalPlaceholder?: string;
  renameModalConfirm?: string;
  renameModalCancel?: string;
  empty?: string;
};

export type CatalogManagerProps = {
  value: CatalogItem[];
  onChange: (items: CatalogItem[]) => void;
  translate?: CatalogTranslate;
  tools?: CatalogToolDefinition[];
  labels?: CatalogManagerLabels;
  renderItem?: (item: Record<string, unknown>, path: Path) => ReactNode;
  className?: string;
  maxDepth?: number;
  indentPerLevel?: number;
};

export type ContextMenuGroupNumbers = {
  move: number;
  delete: number;
};
