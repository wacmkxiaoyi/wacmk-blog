# Usage Guide

## Basic Markdown Rendering

```jsx
import { ContentRenderer, MarkdownPreset } from "../index";

<ContentRenderer
  format="markdown"
  value={markdownString}
  adapter={MarkdownPreset.adapter}
  plugins={MarkdownPreset.plugins}
/>;
```

## Register Custom Components

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

## Use TOC Data

```jsx
const [document, setDocument] = useState(null);
const toc = useContentToc(document);
```
