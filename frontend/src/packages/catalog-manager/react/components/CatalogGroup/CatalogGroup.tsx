import React from "react";
import type { ReactNode } from "react";
import type {
  CatalogItem,
  Path,
  CatalogToolDefinition,
  CatalogToolContext,
  CatalogManagerLabels,
  CatalogTranslate,
} from "../../../core/types.ts";
import { getCatalogNodeKey } from "../../../core/tree-utils.ts";
import type { DropState } from "../../hooks/useCatalogState.ts";
import { CatalogRow } from "../CatalogRow/CatalogRow.tsx";
import styles from "./CatalogGroup.module.css";

type CatalogGroupRendererProps = {
  node: CatalogItem;
  path: Path;
  depth: number;
  maxDepth?: number;
  tools: CatalogToolDefinition[];
  toolContext: CatalogToolContext;
  labels?: CatalogManagerLabels;
  translate?: CatalogTranslate;
  renderItem?: (item: Record<string, unknown>, path: Path) => ReactNode;
  indentPerLevel: number;
  dropState: DropState;
  onDragStart: (e: React.DragEvent<HTMLElement>, path: Path) => void;
  onDragEnd: (e: React.DragEvent<HTMLElement>) => void;
  onDragOver: (
    e: React.DragEvent<HTMLElement>,
    path: Path,
    isGroup: boolean,
  ) => void;
  onDragLeave: (e: React.DragEvent<HTMLElement>) => void;
  onContainerDragOver: (e: React.DragEvent<HTMLElement>, path: Path) => void;
  onActionMoveUp: (path: Path) => void;
  onActionMoveDown: (path: Path) => void;
  onActionRename: (path: Path) => void;
  onActionDelete: (path: Path) => void;
  onDrop: (
    e: React.DragEvent<HTMLElement>,
    targetPath: Path,
    position: "before" | "after" | "inside" | "append",
  ) => void;
  collapsedKeys: Set<string>;
  onToggleCollapse: (path: Path) => void;
};

export function renderCatalogTree(props: CatalogGroupRendererProps): ReactNode {
  const { node, path, depth } = props;
  const isAppendTarget = Boolean(
    props.dropState.position === "append" &&
    props.dropState.path &&
    props.dropState.path.length === path.length &&
    props.dropState.path.every((segment, index) => segment === path[index]),
  );

  if (
    node &&
    typeof node === "object" &&
    "_kind" in node &&
    node._kind === "catalog-group"
  ) {
    const group = node;
    const collapsed = props.collapsedKeys.has(group._key);
    return (
      <div key={getCatalogNodeKey(group, path)} className={styles.groupWrapper}>
        <CatalogRow
          node={node}
          path={path}
          depth={depth}
          collapsed={collapsed}
          onToggleCollapse={props.onToggleCollapse}
          {...props}
        />
        {!collapsed ? (
          <div
            className={[
              styles.groupChildren,
              isAppendTarget ? styles.groupChildrenAppend : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onDragOver={(e) => {
              e.stopPropagation();
              props.onContainerDragOver(e, path);
            }}
            onDragLeave={props.onDragLeave}
            onDrop={(e) => {
              e.stopPropagation();
              props.onDrop(e, path, "append");
            }}
          >
            {group.children.map((child, idx) => {
              const childPath = [...path, idx];
              return (
                <div key={getCatalogNodeKey(child, childPath)}>
                  {renderCatalogTree({
                    ...props,
                    node: child,
                    path: childPath,
                    depth: depth + 1,
                  })}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  return <CatalogRow node={node} path={path} depth={depth} {...props} />;
}
