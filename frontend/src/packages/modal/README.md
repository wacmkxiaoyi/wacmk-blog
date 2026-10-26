# modal

A reusable React modal package for the WACMK frontend.

## Goals

- Declarative API
- Nested modal stack support
- Local SVG icons for tone variants
- Brand-aligned default styles
- No business-specific workflow coupling

## Basic usage

```tsx
import { Modal } from "../modal";

function Example({ open, setOpen }) {
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Rename group"
      kicker="Chapters"
      tone="normal"
      labels={{ cancel: "Cancel", confirm: "Save" }}
      actions={[
        {
          key: "cancel",
          variant: "secondary",
          onClick: ({ close }) => close(),
        },
        {
          key: "save",
          variant: "primary",
          onClick: async ({ close }) => close(),
        },
      ]}
    >
      <div>Your custom content</div>
    </Modal>
  );
}
```
