import React from "react";

export function renderBlockNode(node, context, key) {
  if (!node) {
    return null;
  }

  switch (node.type) {
    case "paragraph": {
      const Component = context.registry.blocks.paragraph;
      return <Component key={key} node={node} context={context} />;
    }
    case "heading": {
      const Component = context.registry.blocks.heading;
      return <Component key={key} node={node} context={context} />;
    }
    case "blockquote": {
      const Component = context.registry.blocks.blockquote;
      return <Component key={key} node={node} context={context} />;
    }
    case "list": {
      const Component = context.registry.blocks.list;
      return <Component key={key} node={node} context={context} />;
    }
    case "code-block": {
      const Component = context.registry.blocks.codeBlock;
      return <Component key={key} node={node} context={context} />;
    }
    case "table": {
      const Component = context.registry.blocks.table;
      return <Component key={key} node={node} context={context} />;
    }
    case "horizontal-rule": {
      const Component = context.registry.blocks.horizontalRule;
      return <Component key={key} node={node} context={context} />;
    }
    case "anchor": {
      const Component = context.registry.blocks.anchor;
      return <Component key={key} node={node} context={context} />;
    }
    case "callout": {
      const Component = context.registry.blocks.callout;
      return <Component key={key} node={node} context={context} />;
    }
    case "admonition": {
      const Component = context.registry.blocks.admonition;
      return <Component key={key} node={node} context={context} />;
    }
    case "tabs": {
      const Component = context.registry.blocks.tabs;
      return <Component key={key} node={node} context={context} />;
    }
    case "math-block": {
      const Component = context.registry.blocks.mathBlock;
      return <Component key={key} node={node} context={context} />;
    }
    case "image": {
      const Component = context.registry.blocks.image;
      return <Component key={key} node={node} context={context} />;
    }
    case "video": {
      const Component = context.registry.blocks.video;
      return <Component key={key} node={node} context={context} />;
    }
    case "custom": {
      const Component = context.registry.blocks.custom;
      return <Component key={key} node={node} context={context} />;
    }
    default:
      return null;
  }
}
