# Content Renderer

`content-renderer` is a reusable content rendering package prototype designed for Markdown-first rendering with a unified content node model.

## Features

- Unified `ContentDocument` schema
- React-based `ContentRenderer`
- Markdown preset with support for:
  - headings, paragraphs, blockquotes, lists, tables, code blocks
  - bold, italic, strike, underline, color text
  - callout, admonition, tabs, math
  - custom directive, video directive
- Renderer override system
- Resolver hooks for links and media
- TOC data hook

## Quick Start

```jsx
import { ContentRenderer, MarkdownPreset } from "./content-renderer";

<ContentRenderer
  format="markdown"
  value="# Hello\n\n++underlined++ text"
  adapter={MarkdownPreset.adapter}
  plugins={MarkdownPreset.plugins}
/>;
```

## Custom Blocks

Use `::custom{...}` for extensible block rendering:

```jsx
<ContentRenderer
  format="markdown"
  value={'::custom{kind="input" name="email" placeholder="Email"}'}
  adapter={MarkdownPreset.adapter}
  plugins={MarkdownPreset.plugins}
  customComponents={{
    input: ({ node }) => <input {...node.data} />,
  }}
/>
```

## Main Public API

- `ContentRenderer`
- `MarkdownPreset`
- `useContentToc`
- Schema exports from `core`
