# tooltip

`tooltip` is a reusable React tooltip package for hover-triggered overlays.

## Goals

- Keep trigger business logic outside the package
- Support interactive tooltip content that can be hovered and clicked
- Render through a portal to avoid clipping inside local containers
- Keep positioning logic testable and independent from React rendering

## Basic usage

```tsx
import { Tooltip } from "../tooltip";

function Example() {
  return (
    <Tooltip
      content={<div>Tooltip content</div>}
      width={240}
      backgroundColor="#111"
      placement="top"
    >
      <button type="button">Hover me</button>
    </Tooltip>
  );
}
```

## Notes

- `content` accepts any React node
- When preferred placement does not fit, the tooltip flips between `top` and `bottom`
- The tooltip stays open while the pointer moves from the trigger into the tooltip panel
