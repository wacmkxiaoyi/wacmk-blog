import React from "react";
import { renderBlockChildren } from "../../utils";
import { TabsController } from "../shared/TabsController";

export function TabsRenderer({ node, context }) {
  return (
    <TabsController
      items={node.items}
      renderLabel={(item) => item.label}
      renderPanel={(item, index) =>
        renderBlockChildren(
          item.children,
          context,
          `${context.currentBlockPath}.items.${index}.children`,
        )
      }
    />
  );
}
