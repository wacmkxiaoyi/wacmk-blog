import React from "react";

export function renderInlineNode(node, context, key) {
  if (!node) {
    return null;
  }

  switch (node.type) {
    case "text": {
      const Component = context.registry.inlines.text;
      return <Component key={key} node={node} context={context} />;
    }
    case "link": {
      const Component = context.registry.inlines.link;
      return <Component key={key} node={node} context={context} />;
    }
    case "inline-code": {
      const Component = context.registry.inlines.inlineCode;
      return <Component key={key} node={node} context={context} />;
    }
    case "inline-math": {
      const Component = context.registry.inlines.inlineMath;
      return <Component key={key} node={node} context={context} />;
    }
    case "emoji": {
      const Component = context.registry.inlines.emoji;
      return <Component key={key} node={node} context={context} />;
    }
    case "checkbox": {
      const Component = context.registry.inlines.checkbox;
      return <Component key={key} node={node} context={context} />;
    }
    case "line-break": {
      const Component = context.registry.inlines.lineBreak;
      return <Component key={key} node={node} context={context} />;
    }
    default:
      return null;
  }
}
