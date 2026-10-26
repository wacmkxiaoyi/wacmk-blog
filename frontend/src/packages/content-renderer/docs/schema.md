# Schema Overview

The renderer uses a unified `ContentDocument` model.

## Top Level

```ts
type ContentDocument = {
  type: "document";
  version: 1;
  format: "markdown" | "rich-text" | "html";
  children: BlockNode[];
  meta?: DocumentMeta;
};
```

## Block Nodes

- paragraph
- heading
- blockquote
- list
- code-block
- table
- horizontal-rule
- callout
- admonition
- tabs
- math-block
- image
- video
- custom

## Inline Nodes

- text
- link
- inline-code
- inline-math
- emoji
- line-break

## Text Marks

- bold
- italic
- strike
- underline
- color
