# Navigator

Floating navigation outline with collapsible tree, drag-to-reposition toggle, and responsive auto-collapse.

## Usage

```jsx
import { Navigator } from "path/to/packages/navigator";

const items = [
  {
    key: "intro",
    label: "Introduction",
    level: 1,
    children: [
      { key: "overview", label: "Overview", level: 2 },
      { key: "setup", label: "Setup", level: 2 },
    ],
  },
  {
    key: "guide",
    label: "Guide",
    level: 1,
    children: [
      { key: "basics", label: "Basics", level: 2, active: true },
      { key: "advanced", label: "Advanced", level: 2 },
    ],
  },
];

<Navigator
  items={items}
  minPageWidth={900}
  expandedWidth={280}
  compactIcon={<span>TOC</span>}
  onNavigate={(node) => console.log("clicked:", node.key)}
/>;
```

## Props

| Prop               | Type                                   | Default                            | Description                             |
| ------------------ | -------------------------------------- | ---------------------------------- | --------------------------------------- |
| `items`            | `NavigateNode[]`                       | required                           | Navigation tree data                    |
| `onNavigate`       | `(node, event) => void`                | —                                  | Called when a clickable node is clicked |
| `initialPosition`  | `string \| {top, left, right, bottom}` | `"top-right"`                      | Initial fixed position                  |
| `minPageWidth`     | `number`                               | `0`                                | Auto-collapse when viewport is narrower |
| `minPageHeight`    | `number`                               | `0`                                | Auto-collapse when viewport is shorter  |
| `compactIcon`      | `ReactNode`                            | built-in icon                      | Icon rendered in compact mode           |
| `expandedWidth`    | `number \| string`                     | `"min(300px, calc(100vw - 2rem))"` | Panel width                             |
| `expandedHeight`   | `number \| string`                     | `"min(calc(100vh - 8rem), 40rem)"` | Panel max-height                        |
| `margin`           | `number`                               | `16`                               | Gap from viewport edges                 |
| `zIndex`           | `number`                               | `160`                              | Base z-index                            |
| `defaultCollapsed` | `boolean`                              | `false`                            | Start collapsed                         |
| `storageKey`       | `string`                               | —                                  | localStorage key for toggle position    |
| `anchorSide`       | `"left" \| "right"`                  | `"left"`                           | Toggle edge used as the position anchor |
| `anchorElement`    | `HTMLElement`                           | —                                  | Element whose outer edge sets the default anchor |
| `anchorOffset`     | `number`                               | `margin`                           | Gap outside `anchorElement`             |
| `collapseBoundaryElement` | `HTMLElement`                    | —                                  | Collapse before responsive fitting reaches this element |

## Behavior

- The floating navigator auto-compacts into an icon when:
  - viewport width is smaller than `minPageWidth`
  - viewport height is smaller than `minPageHeight`
  - the expanded panel cannot fully fit inside the viewport at its current position
- With `collapseBoundaryElement`, it compacts before responsive repositioning would overlap that element.
- `anchorSide="right"` keeps the toggle on the panel's right edge while its content remains left-to-right.
- The floating navigator is always draggable in both expanded and compact states
- Embedded mode (`embedded`) stays inline and does not auto-compact

## NavigateNode

```ts
interface NavigateNode {
  key: string; // Unique identifier
  label: string; // Display text
  level?: number; // 1 = H1, 2 = H2, … (controls indentation)
  clickable?: boolean; // Whether clickable (default: true)
  defaultCollapsed?: boolean; // Start with children hidden
  children?: NavigateNode[]; // Sub-nodes (indented)
  active?: boolean; // Highlight as active
  data?: any; // Passed to onNavigate
  icon?: ReactNode; // Optional icon
  badge?: string | ReactNode; // Optional badge
}
```

## CSS Custom Properties

Override any of the `--navigator-*` variables to customize appearance.
See `react/theme/variables.css` for the full list.
