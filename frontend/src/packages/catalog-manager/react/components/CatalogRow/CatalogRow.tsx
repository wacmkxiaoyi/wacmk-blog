import React from "react";
import { useContextActionsMenu } from "../../../../context-actions/index.ts";
import type { ContextActionGroup } from "../../../../context-actions/core/index.ts";
import type {
  CatalogItem,
  Path,
  CatalogToolDefinition,
  CatalogToolContext,
  CatalogManagerLabels,
  CatalogTranslate,
} from "../../../core/types.ts";
import {
  isCatalogGroup,
  canMoveUp,
  canMoveDown,
} from "../../../core/tree-utils.ts";
import { resolveCatalogLabel } from "../../../core/i18n.ts";
import { getDropIndicatorClass } from "../../hooks/useCatalogState.ts";
import type { DropState } from "../../hooks/useCatalogState.ts";
import styles from "./CatalogRow.module.css";

type CatalogRowProps = {
  node: CatalogItem;
  path: Path;
  depth: number;
  tools: CatalogToolDefinition[];
  toolContext: CatalogToolContext;
  labels?: CatalogManagerLabels;
  translate?: CatalogTranslate;
  renderItem?: (item: Record<string, unknown>, path: Path) => React.ReactNode;
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
  onDrop: (
    e: React.DragEvent<HTMLElement>,
    targetPath: Path,
    position: "before" | "after" | "inside",
  ) => void;
  onActionMoveUp: (path: Path) => void;
  onActionMoveDown: (path: Path) => void;
  onActionRename: (path: Path) => void;
  onActionDelete: (path: Path) => void;
  collapsed?: boolean;
  onToggleCollapse?: (path: Path) => void;
};

export function CatalogRow({
  node,
  path,
  depth,
  tools,
  toolContext,
  labels,
  translate,
  renderItem,
  indentPerLevel,
  dropState,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onActionMoveUp,
  onActionMoveDown,
  onActionRename,
  onActionDelete,
  collapsed = false,
  onToggleCollapse,
}: CatalogRowProps) {
  const { menu, toggleRightClick } = useContextActionsMenu({ zIndex: 2200 });
  const group = isCatalogGroup(node);

  const moveUpLabel =
    labels?.moveUp ??
    resolveCatalogLabel(translate, "catalog.moveUp", "Move up");
  const moveDownLabel =
    labels?.moveDown ??
    resolveCatalogLabel(translate, "catalog.moveDown", "Move down");
  const renameLabel =
    labels?.rename ??
    resolveCatalogLabel(translate, "catalog.rename", "Rename");
  const deleteLabel =
    labels?.delete ??
    resolveCatalogLabel(translate, "catalog.delete", "Delete");

  const moveActions: ContextActionGroup = {
    group: 0,
    children: [
      {
        key: "catalog-move-up",
        label: moveUpLabel,
        onClick: () => onActionMoveUp(path),
        disabled: !canMoveUp(toolContext.items, path),
      },
      {
        key: "catalog-move-down",
        label: moveDownLabel,
        onClick: () => onActionMoveDown(path),
        disabled: !canMoveDown(toolContext.items, path),
      },
    ],
  };

  const deleteActions: ContextActionGroup = {
    group: 999,
    children: [
      {
        key: "catalog-delete",
        label: deleteLabel,
        onClick: () => onActionDelete(path),
        danger: true,
      },
    ],
  };

  const toolMenuGroups = tools
    .filter((t) => t.getContextMenuGroups)
    .flatMap((t) => {
      const result = t.getContextMenuGroups?.(toolContext, node, path);
      return result ?? [];
    });

  const renameGroup: ContextActionGroup[] = group
    ? [
        {
          group: 960,
          children: [
            {
              key: "catalog-rename",
              label: renameLabel,
              onClick: () => onActionRename(path),
            },
          ],
        },
      ]
    : [];

  const contextMenuGroups: ContextActionGroup[] = [
    moveActions,
    ...toolMenuGroups,
    ...renameGroup,
    deleteActions,
  ];

  const handleContextMenu = (e: React.MouseEvent) => {
    toggleRightClick(e, contextMenuGroups);
  };

  const dropClass = getDropIndicatorClass(path, dropState);

  return (
    <div className={styles.rowShell}>
      <div
        className={[styles.row, dropClass].filter(Boolean).join(" ")}
        draggable
        onDragStart={(e) => onDragStart(e, path)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => {
          e.stopPropagation();
          onDragOver(e, path, group);
        }}
        onDragLeave={onDragLeave}
        onDrop={(e) => {
          e.stopPropagation();
          const position =
            dropState.position === "inside" && group
              ? "inside"
              : dropState.position === "before"
                ? "before"
                : "after";
          onDrop(e, path, position);
        }}
        onContextMenu={handleContextMenu}
        style={{ paddingLeft: `${depth * indentPerLevel}px` }}
      >
        <div className={styles.dragHandle}>
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className={styles.dragHandleIcon}
          >
            <circle cx="9" cy="5" r="1.5" />
            <circle cx="15" cy="5" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="19" r="1.5" />
            <circle cx="15" cy="19" r="1.5" />
          </svg>
        </div>

        <div className={styles.main}>
          <span className={styles.kindIcon}>
            {group ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            )}
          </span>

          {group ? (
            <span className={styles.groupTitleWrap}>
              <span className={styles.title}>{node.title}</span>
              <button
                type="button"
                className={styles.inlineToggleButton}
                onClick={() => onToggleCollapse?.(path)}
                title={collapsed ? "Expand" : "Collapse"}
              >
                {collapsed ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
              </button>
            </span>
          ) : renderItem ? (
            renderItem(node as Record<string, unknown>, path)
          ) : (
            <span className={styles.title}>{JSON.stringify(node)}</span>
          )}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => onActionMoveUp(path)}
            disabled={!canMoveUp(toolContext.items, path)}
            title={moveUpLabel}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => onActionMoveDown(path)}
            disabled={!canMoveDown(toolContext.items, path)}
            title={moveDownLabel}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
          </button>

          {group ? (
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => onActionRename(path)}
              title={renameLabel}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
          ) : null}

          <button
            type="button"
            className={styles.actionButton}
            onClick={() => onActionDelete(path)}
            title={deleteLabel}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>
      {menu}
    </div>
  );
}
