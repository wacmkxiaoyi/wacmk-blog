import React, { useCallback, useId, useState } from "react";
import { Modal } from "../../../../modal/index.ts";
import type {
  CatalogItem,
  Path,
  CatalogToolContext,
  CatalogManagerLabels,
} from "../../../core/types.ts";
import type { CatalogTranslate } from "../../../core/types.ts";
import {
  isCatalogGroup,
  moveNodeAtPath,
  removeNodeAtPath,
  canDropAsDescendant,
  replaceNodeAtPath,
  generateKey,
  getCatalogNodeKey,
} from "../../../core/tree-utils.ts";
import { resolveCatalogLabel } from "../../../core/i18n.ts";
import { useCatalogDragDrop } from "../../hooks/useCatalogState.ts";
import type { CatalogToolDefinition } from "../../../core/types.ts";
import { CatalogToolbar } from "../CatalogToolbar/CatalogToolbar.tsx";
import { renderCatalogTree } from "../CatalogGroup/CatalogGroup.tsx";
import styles from "./CatalogManager.module.css";
import "../../theme/variables.css";

type CatalogManagerProps = {
  value: CatalogItem[];
  onChange: (items: CatalogItem[]) => void;
  translate?: CatalogTranslate;
  tools?: CatalogToolDefinition[];
  labels?: CatalogManagerLabels;
  renderItem?: (item: Record<string, unknown>, path: Path) => React.ReactNode;
  className?: string;
  maxDepth?: number;
  indentPerLevel?: number;
};

export function CatalogManager({
  value,
  onChange,
  translate,
  tools = [],
  labels,
  renderItem,
  className,
  maxDepth,
  indentPerLevel = 24,
}: CatalogManagerProps) {
  const addGroupId = useId();
  const renameId = useId();
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renamePath, setRenamePath] = useState<Path | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(
    () => new Set(),
  );

  const {
    dropState,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleContainerDragOver,
    handleDragLeave,
    getDragPath,
    clearDropState,
  } = useCatalogDragDrop();

  const toolContext: CatalogToolContext = {
    items: value,
    setItems: onChange,
  };

  const handleDrop = useCallback(
    (
      e: React.DragEvent<HTMLElement>,
      targetPath: Path,
      position: "before" | "after" | "inside" | "append",
    ) => {
      e.preventDefault();
      const dragPath = getDragPath();
      if (!dragPath) {
        return;
      }

      if (position === "inside" || position === "append") {
        if (JSON.stringify(dragPath) === JSON.stringify(targetPath)) {
          clearDropState();
          return;
        }
        if (canDropAsDescendant(dragPath, targetPath)) {
          clearDropState();
          return;
        }
      }

      const next = moveNodeAtPath(
        value,
        dragPath,
        targetPath,
        position,
        maxDepth,
      );
      onChange(next);
      clearDropState();
    },
    [value, onChange, getDragPath, maxDepth, clearDropState],
  );

  const handleMoveUp = useCallback(
    (path: Path) => {
      const parentPath = path.slice(0, -1);
      const idx = path[path.length - 1];

      if (idx <= 0) {
        return;
      }

      const swapped = JSON.parse(JSON.stringify(value)) as CatalogItem[];
      const parentArr =
        parentPath.length === 0
          ? swapped
          : (() => {
              let arr = swapped;
              for (let i = 0; i < parentPath.length; i++) {
                const node = arr[parentPath[i]];
                if (isCatalogGroup(node)) {
                  arr = node.children;
                } else {
                  return null;
                }
              }
              return arr;
            })();

      if (!parentArr) {
        return;
      }

      [parentArr[idx - 1], parentArr[idx]] = [
        parentArr[idx],
        parentArr[idx - 1],
      ];
      onChange(swapped);
    },
    [value, onChange],
  );

  const handleMoveDown = useCallback(
    (path: Path) => {
      const parentPath = path.slice(0, -1);
      const idx = path[path.length - 1];

      const swapped = JSON.parse(JSON.stringify(value)) as CatalogItem[];
      const parentArr =
        parentPath.length === 0
          ? swapped
          : (() => {
              let arr = swapped;
              for (let i = 0; i < parentPath.length; i++) {
                const node = arr[parentPath[i]];
                if (isCatalogGroup(node)) {
                  arr = node.children;
                } else {
                  return null;
                }
              }
              return arr;
            })();

      if (!parentArr) {
        return;
      }

      if (idx >= parentArr.length - 1) {
        return;
      }

      [parentArr[idx], parentArr[idx + 1]] = [
        parentArr[idx + 1],
        parentArr[idx],
      ];
      onChange(swapped);
    },
    [value, onChange],
  );

  const handleDelete = useCallback(
    (path: Path) => {
      const copy = JSON.parse(JSON.stringify(value)) as CatalogItem[];
      removeNodeAtPath(copy, path);
      onChange(copy);
    },
    [value, onChange],
  );

  const handleRename = useCallback(
    (path: Path) => {
      const node = (() => {
        let arr: CatalogItem[] = value;
        for (let i = 0; i < path.length; i++) {
          const n = arr[path[i]];
          if (i === path.length - 1) {
            return n;
          }
          if (isCatalogGroup(n)) {
            arr = n.children;
          } else {
            return null;
          }
        }
        return null;
      })();

      if (node && isCatalogGroup(node)) {
        setRenamePath(path);
        setRenameValue(node.title);
        setRenameOpen(true);
      }
    },
    [value],
  );

  const handleAddGroup = useCallback(() => {
    setGroupName("");
    setAddGroupOpen(true);
  }, []);

  const handleToggleCollapse = useCallback(
    (path: Path) => {
      const target = value[path[0]];
      if (!target) {
        return;
      }

      let node = target;
      for (let i = 1; i < path.length; i++) {
        if (!isCatalogGroup(node)) {
          return;
        }
        node = node.children[path[i]];
      }

      if (!isCatalogGroup(node)) {
        return;
      }

      setCollapsedKeys((current) => {
        const next = new Set(current);
        if (next.has(node._key)) {
          next.delete(node._key);
        } else {
          next.add(node._key);
        }
        return next;
      });
    },
    [value],
  );

  const confirmAddGroup = useCallback(() => {
    const title = groupName.trim();
    if (!title) {
      return;
    }

    const newGroup = {
      _kind: "catalog-group" as const,
      _key: generateKey(),
      title,
      children: [],
    };

    onChange([...value, newGroup]);
    setAddGroupOpen(false);
  }, [groupName, value, onChange]);

  const confirmRename = useCallback(() => {
    const title = renameValue.trim();
    if (!title || !renamePath) {
      return;
    }

    const next = replaceNodeAtPath(value, renamePath, (node) => {
      if (isCatalogGroup(node)) {
        return { ...node, title };
      }
      return node;
    });

    onChange(next);
    setRenameOpen(false);
    setRenamePath(null);
  }, [renameValue, renamePath, value, onChange]);

  const addGroupTitle =
    labels?.addGroupModalTitle ??
    resolveCatalogLabel(translate, "catalog.addGroup.title", "New group");
  const addGroupPlaceholder =
    labels?.addGroupModalPlaceholder ??
    resolveCatalogLabel(
      translate,
      "catalog.addGroup.placeholder",
      "Enter group name",
    );
  const addGroupConfirm =
    labels?.addGroupModalConfirm ??
    resolveCatalogLabel(translate, "catalog.addGroup.confirm", "Create");
  const addGroupCancel =
    labels?.addGroupModalCancel ??
    resolveCatalogLabel(translate, "catalog.addGroup.cancel", "Cancel");

  const renameTitle =
    labels?.renameModalTitle ??
    resolveCatalogLabel(translate, "catalog.rename.title", "Rename");
  const renamePlaceholder =
    labels?.renameModalPlaceholder ??
    resolveCatalogLabel(
      translate,
      "catalog.rename.placeholder",
      "Enter new name",
    );
  const renameConfirm =
    labels?.renameModalConfirm ??
    resolveCatalogLabel(translate, "catalog.rename.confirm", "Rename");
  const renameCancel =
    labels?.renameModalCancel ??
    resolveCatalogLabel(translate, "catalog.rename.cancel", "Cancel");

  const emptyLabel =
    labels?.empty ??
    resolveCatalogLabel(
      translate,
      "catalog.empty",
      "No items yet. Use the toolbar to add content.",
    );

  const treeRendererProps = {
    tools,
    toolContext,
    labels,
    translate,
    renderItem,
    indentPerLevel,
    dropState,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onDragOver: handleDragOver,
    onContainerDragOver: handleContainerDragOver,
    onDragLeave: handleDragLeave,
    onActionMoveUp: handleMoveUp,
    onActionMoveDown: handleMoveDown,
    onActionRename: handleRename,
    onActionDelete: handleDelete,
    onDrop: handleDrop,
    collapsedKeys,
    onToggleCollapse: handleToggleCollapse,
    maxDepth,
  };

  return (
    <div className={[styles.panel, className].filter(Boolean).join(" ")}>
      <CatalogToolbar
        tools={tools}
        toolContext={toolContext}
        labels={labels}
        translate={translate}
        onAddGroup={handleAddGroup}
      />

      <div
        className={[
          styles.list,
          dropState.position === "append" &&
          dropState.path &&
          dropState.path.length === 0
            ? styles.listAppend
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onDragOver={(e) => {
          e.stopPropagation();
          handleContainerDragOver(e, []);
        }}
        onDragLeave={handleDragLeave}
        onDrop={(e) => {
          e.stopPropagation();
          handleDrop(e, [], "append");
        }}
      >
        {value.length === 0 ? (
          <div className={styles.empty}>{emptyLabel}</div>
        ) : (
          value.map((node, idx) => {
            const nodePath = [idx];
            return (
              <div
                key={getCatalogNodeKey(node, nodePath)}
                className={styles.item}
              >
                {renderCatalogTree({
                  ...treeRendererProps,
                  node,
                  path: nodePath,
                  depth: 0,
                })}
              </div>
            );
          })
        )}
      </div>

      <Modal
        open={addGroupOpen}
        onOpenChange={setAddGroupOpen}
        title={addGroupTitle}
        size="sm"
        actions={[
          {
            key: "cancel",
            label: addGroupCancel,
            variant: "secondary",
            onClick: (api) => api.close(),
          },
          {
            key: "confirm",
            label: addGroupConfirm,
            variant: "primary",
            onClick: (api) => {
              confirmAddGroup();
              api.close();
            },
          },
        ]}
      >
        <input
          id={addGroupId}
          type="text"
          className={styles.modalInput}
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder={addGroupPlaceholder}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              confirmAddGroup();
            }
          }}
        />
      </Modal>

      <Modal
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title={renameTitle}
        size="sm"
        actions={[
          {
            key: "cancel",
            label: renameCancel,
            variant: "secondary",
            onClick: (api) => api.close(),
          },
          {
            key: "confirm",
            label: renameConfirm,
            variant: "primary",
            onClick: (api) => {
              confirmRename();
              api.close();
            },
          },
        ]}
      >
        <input
          id={renameId}
          type="text"
          className={styles.modalInput}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          placeholder={renamePlaceholder}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              confirmRename();
            }
          }}
        />
      </Modal>
    </div>
  );
}
