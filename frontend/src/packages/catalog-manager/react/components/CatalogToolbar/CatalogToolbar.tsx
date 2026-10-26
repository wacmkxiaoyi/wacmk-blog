import React from "react";
import type {
  CatalogToolDefinition,
  CatalogToolContext,
} from "../../../core/types.ts";
import { resolveCatalogLabel } from "../../../core/i18n.ts";
import type { CatalogManagerLabels } from "../../../core/types.ts";
import styles from "./CatalogToolbar.module.css";

type CatalogToolbarProps = {
  tools: CatalogToolDefinition[];
  toolContext: CatalogToolContext;
  labels?: CatalogManagerLabels;
  translate?: (key: string, fallback: string) => string;
  onAddGroup: () => void;
};

export function CatalogToolbar({
  tools,
  toolContext,
  labels,
  translate,
  onAddGroup,
}: CatalogToolbarProps) {
  const [hoveredTool, setHoveredTool] = React.useState<string | null>(null);

  const addGroupLabel =
    labels?.toolbarAddGroup ??
    resolveCatalogLabel(translate, "catalog.toolbar.addGroup", "Add group");

  const allTools = React.useMemo(() => {
    const internalTool: CatalogToolDefinition = {
      key: "catalog-add-group",
      name: addGroupLabel,
      icon: (
        <svg
          className={styles.toolIconSvg}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      ),
      group: 999,
      order: 999,
      onClick: onAddGroup,
    };

    return [...tools, internalTool].filter(
      (tool) => tool.isVisible?.(toolContext) ?? true,
    );
  }, [addGroupLabel, onAddGroup, toolContext, tools]);

  const sortedTools = React.useMemo(
    () =>
      [...allTools].sort((a, b) => {
        if ((a.group ?? 1) !== (b.group ?? 1)) {
          return (a.group ?? 1) - (b.group ?? 1);
        }
        return (a.order ?? 0) - (b.order ?? 0);
      }),
    [allTools],
  );

  const groupedTools = React.useMemo(() => {
    return sortedTools.reduce((result, tool) => {
      const group = tool.group ?? 1;
      const current = result.get(group) || [];
      current.push(tool);
      result.set(group, current);
      return result;
    }, new Map<number, CatalogToolDefinition[]>());
  }, [sortedTools]);

  return (
    <div
      className={styles.toolbarShell}
      onMouseLeave={() => setHoveredTool(null)}
    >
      <div
        className={styles.toolbar}
        role="toolbar"
        aria-label="Catalog actions"
      >
        {Array.from(groupedTools.entries()).map(
          ([group, items], groupIndex) => (
            <div key={group} className={styles.toolbarGroup}>
              {groupIndex > 0 ? (
                <div className={styles.toolbarDivider} />
              ) : null}
              {items.map((tool) => {
                const expanded = hoveredTool === tool.key;
                const disabled = tool.isDisabled?.(toolContext) ?? false;

                return (
                  <button
                    key={tool.key}
                    type="button"
                    className={[
                      styles.toolButton,
                      expanded ? styles.toolButtonExpanded : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={disabled}
                    onMouseEnter={() =>
                      setHoveredTool(disabled ? null : tool.key)
                    }
                    onFocus={() => setHoveredTool(disabled ? null : tool.key)}
                    onClick={() => tool.onClick?.(toolContext)}
                    title={tool.name}
                  >
                    <span className={styles.toolIcon}>{tool.icon}</span>
                    <span
                      className={[
                        styles.toolLabel,
                        expanded ? styles.toolLabelExpanded : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {tool.name}
                    </span>
                  </button>
                );
              })}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
