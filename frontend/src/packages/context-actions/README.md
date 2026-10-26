# context-actions

`context-actions` is a reusable React context action menu package for grouped action rendering.

## Goals

- Keep business triggers outside the package
- Render grouped actions with automatic separators
- Reuse one visual shell across table, editor, or custom scenes
- Preserve the old WACMK menu style while staying publishable and framework-clean

## API shape

```tsx
import { useContextActionsMenu } from "./context-actions";

function Example() {
  const { menu, toggleRightClick } = useContextActionsMenu();

  return (
    <>
      <div
        onContextMenu={(event) =>
          toggleRightClick(event, [
            {
              group: 1,
              children: [
                {
                  key: "edit",
                  label: "Edit",
                  icon: <span>e</span>,
                  onClick: () => {},
                },
                {
                  key: "browse",
                  label: "Browse",
                  icon: <span>b</span>,
                  onClick: () => {},
                },
              ],
            },
            {
              group: 2,
              children: [
                {
                  key: "delete",
                  label: "Delete",
                  icon: <span>d</span>,
                  danger: true,
                  onClick: () => {},
                },
              ],
            },
          ])
        }
      >
        Right click me
      </div>
      {menu}
    </>
  );
}
```

## Data model

```ts
type ContextActionItem = {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  danger?: boolean;
  hidden?: boolean;
};

type ContextActionGroup = {
  group: number;
  children: ContextActionItem[];
};
```

The package sorts groups by `group`, removes empty groups, filters hidden children, and inserts separators between non-empty groups automatically.
