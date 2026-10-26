import { useCallback, useState } from "react";
import type { NavigateNode } from "../../../core/types";
import styles from "./NavigatorTree.module.css";

interface NavigatorTreeProps {
  nodes: NavigateNode[];
  onNavigate?: (node: NavigateNode, event: React.MouseEvent) => void;
  level?: number;
  currentKey?: string;
}

function NodeLabel({
  node,
  onNavigate,
  hasChildren,
  expanded,
  onChevronClick,
  currentKey,
  depth,
}: {
  node: NavigateNode;
  onNavigate?: (node: NavigateNode, event: React.MouseEvent) => void;
  hasChildren: boolean;
  expanded: boolean;
  onChevronClick?: (e: React.MouseEvent) => void;
  currentKey?: string;
  depth: number;
}) {
  const level = node.level ?? depth + 1;
  const indentFallback =
    level === 2
      ? "calc(4ch - 0.62rem)"
      : level === 3
        ? "calc(8ch - 0.62rem)"
        : "calc(12ch - 0.62rem)";
  const indentStyle =
    level > 1
      ? {
          paddingLeft: `var(--navigator-indent-level${level}, ${indentFallback})`,
        }
      : undefined;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (node.clickable === false) return;
      onNavigate?.(node, e);
    },
    [node, onNavigate],
  );

  const isClickable = node.clickable !== false;
  const isActive =
    node.active === true || (currentKey != null && node.key === currentKey);

  return (
    <div
      className={`${styles.item} ${isActive ? styles.active : ""} ${isClickable ? styles.clickable : styles.nonClickable}`}
      style={indentStyle}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick(e as any);
              }
            }
          : undefined
      }
    >
      <span className={styles.iconSlot}>{node.icon || null}</span>
      <span className={styles.label}>{node.label}</span>
      {node.badge && (
        <span className={styles.badge}>
          {typeof node.badge === "string" ? (
            <span className={styles.badgeText}>{node.badge}</span>
          ) : (
            node.badge
          )}
        </span>
      )}
      {hasChildren && (
        <button
          type="button"
          className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
          onClick={onChevronClick}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="14"
            height="14"
          >
            <polyline points="5 3 11 8 5 13" />
          </svg>
        </button>
      )}
    </div>
  );
}

function NavigatorTreeNode({
  node,
  onNavigate,
  depth,
  currentKey,
}: {
  node: NavigateNode;
  onNavigate?: (node: NavigateNode, event: React.MouseEvent) => void;
  depth: number;
  currentKey?: string;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const [collapsed, setCollapsed] = useState(node.defaultCollapsed || false);

  const handleChevronClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed((prev) => !prev);
  }, []);

  return (
    <li className={styles.treeItem}>
      <NodeLabel
        node={node}
        onNavigate={onNavigate}
        hasChildren={hasChildren}
        expanded={!collapsed}
        onChevronClick={handleChevronClick}
        currentKey={currentKey}
        depth={depth}
      />
      {hasChildren && !collapsed && (
        <ul className={styles.list}>
          {node.children!.map((child, index) => (
            <NavigatorTreeNode
              key={`${child.key || "node"}-${index}`}
              node={child}
              onNavigate={onNavigate}
              depth={depth + 1}
              currentKey={currentKey}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function NavigatorTree({
  nodes,
  onNavigate,
  level = 0,
  currentKey,
}: NavigatorTreeProps) {
  if (!nodes || nodes.length === 0) {
    return null;
  }

  if (level === 0) {
    return (
      <ul className={styles.list}>
        {nodes.map((node, index) => (
          <NavigatorTreeNode
            key={`${node.key || "node"}-${index}`}
            node={node}
            onNavigate={onNavigate}
            depth={0}
            currentKey={currentKey}
          />
        ))}
      </ul>
    );
  }

  return (
    <>
      {nodes.map((node, index) => (
        <NavigatorTreeNode
          key={`${node.key || "node"}-${index}`}
          node={node}
          onNavigate={onNavigate}
          depth={level}
          currentKey={currentKey}
        />
      ))}
    </>
  );
}
