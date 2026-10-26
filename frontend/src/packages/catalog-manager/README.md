# Catalog Manager

A reusable React component for visually managing an ordered array of items with grouping support, drag-and-drop reordering, context menus, and an extensible toolbar.

## Features

- **Tree array editing** — visually manage a JSON array with nested groups
- **Drag and drop** — reorder items, move items between groups (native HTML5 DnD)
- **Context menu** — built-in Move Up / Move Down / Rename (groups) / Delete, plus extensible via tool definitions
- **Extensible toolbar** — built-in "Add group" tool, plus consumer-provided custom tools
- **Controlled component** — `value` + `onChange` pattern

## Quick start

```tsx
import { CatalogManager } from "@/packages/catalog-manager";
import type { CatalogItem } from "@/packages/catalog-manager";

function Page() {
  const [items, setItems] = React.useState<CatalogItem[]>([
    {
      _kind: "catalog-group",
      _key: "g1",
      title: "Chapter 1",
      children: [
        { id: 1, title: "Article 1" },
        { id: 2, title: "Article 2" },
      ],
    },
    { id: 3, title: "Standalone article" },
  ]);

  return (
    <CatalogManager
      value={items}
      onChange={setItems}
      renderItem={(item) => <span>{item.title}</span>}
    />
  );
}
```

## Props

| Prop             | Type                        | Default          | Description                        |
| ---------------- | --------------------------- | ---------------- | ---------------------------------- |
| `value`          | `CatalogItem[]`             | required         | Controlled catalog data            |
| `onChange`       | `(items) => void`           | required         | Called on any data mutation        |
| `renderItem`     | `(item, path) => ReactNode` | `JSON.stringify` | Custom render for leaf items       |
| `tools`          | `CatalogToolDefinition[]`   | `[]`             | Consumer-provided toolbar tools    |
| `translate`      | `(key, fallback) => string` | built-in EN      | Translation function               |
| `labels`         | `CatalogManagerLabels`      | built-in EN      | Override built-in UI strings       |
| `maxDepth`       | `number`                    | undefined        | Maximum nesting depth              |
| `indentPerLevel` | `number`                    | `24`             | Pixels of indent per nesting level |
| `className`      | `string`                    | `""`             | Extra CSS class on the panel       |

## Tool definition

```ts
type CatalogToolDefinition = {
  key: string;
  name: string;
  icon: ReactNode;
  group?: number;
  order?: number;
  onClick?: (ctx: CatalogToolContext) => void;
  isVisible?: (ctx: CatalogToolContext) => boolean;
  isDisabled?: (ctx: CatalogToolContext) => boolean;
  getContextMenuGroups?: (ctx, node, path) => ContextActionGroup[];
};
```

## Context menu groups

| Group | Content                                            |
| ----- | -------------------------------------------------- |
| 0     | Move Up / Move Down (built-in, always)             |
| 1–959 | Custom items from `tools[].getContextMenuGroups()` |
| 960   | Rename (groups only, always)                       |
| 999   | Delete (built-in, always)                          |

## Data model

```ts
type CatalogGroup = {
  _kind: "catalog-group";
  _key: string;
  title: string;
  children: CatalogItem[];
};

type CatalogItem = CatalogGroup | Record<string, unknown>;
```

## i18n

The package ships built-in English fallbacks. Provide a `translate` function to integrate with your app's i18n:

```tsx
const { t } = useI18n();
<CatalogManager
  translate={(key, fallback) => t(`catalog.${key.split(".").pop()}`, fallback)}
/>;
```

Translation keys: `catalog.toolbar.addGroup`, `catalog.addGroup.title`, `catalog.addGroup.placeholder`, `catalog.addGroup.confirm`, `catalog.addGroup.cancel`, `catalog.moveUp`, `catalog.moveDown`, `catalog.rename`, `catalog.delete`, `catalog.rename.title`, `catalog.rename.placeholder`, `catalog.rename.confirm`, `catalog.rename.cancel`, `catalog.empty`.
