import type { ContentDocument } from "../schema/document";

export type ContentMenuItem = {
  id: string;
  level: number;
  text: string;
  children: ContentMenuItem[];
};

export type CreateContentNavigationOptions = {
  minLevel?: number;
  maxLevel?: number;
  includeUntitled?: boolean;
  tree?: boolean;
  filter?: (item: ContentMenuItem) => boolean;
};

export type ExtractHeadingMenuItemsOptions = Pick<
  CreateContentNavigationOptions,
  "minLevel" | "maxLevel" | "includeUntitled" | "filter"
>;

export type ContentNavigation = {
  document: ContentDocument | null;
  items: ContentMenuItem[];
  flatItems: ContentMenuItem[];
  getItemById: (id: string) => ContentMenuItem | null;
  hasItem: (id: string) => boolean;
};
