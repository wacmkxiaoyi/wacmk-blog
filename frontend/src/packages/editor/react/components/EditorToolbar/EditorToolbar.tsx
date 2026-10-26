import React from "react";
import type {
  EditorToolContext,
  EditorToolDefinition,
} from "../../../core/types.ts";
import {
  isToolActive,
  isToolbarToolDisabled,
} from "../RichTextEditor/helpers/toolExecutionHelpers.ts";
import styles from "./EditorToolbar.module.css";

type EditorToolbarProps = {
  groupedTools: Record<number, EditorToolDefinition[]>;
  toolIndex: Record<string, EditorToolDefinition>;
  editor: unknown;
  markdownMode: boolean;
  toolContext: EditorToolContext;
  onExecuteTool: (tool: EditorToolDefinition, event?: unknown) => void;
};

export function EditorToolbar({
  groupedTools,
  toolIndex,
  editor,
  markdownMode,
  toolContext,
  onExecuteTool,
}: EditorToolbarProps) {
  const [hoveredTool, setHoveredTool] = React.useState<string | null>(null);

  return (
    <div
      className={styles.toolbarShell}
      onMouseLeave={() => setHoveredTool(null)}
    >
      <div className={styles.toolbar}>
        {Object.entries(groupedTools).map(([group, items], groupIndex) => (
          <div key={group} className={styles.toolbarGroup}>
            {groupIndex > 0 ? <div className={styles.toolbarDivider} /> : null}
            {items.map((tool) => {
              const isExpanded = hoveredTool === tool.key;
              const active =
                tool.isActive?.(toolContext) ??
                isToolActive(editor, markdownMode, tool.key);
              const toolDisabled = isToolbarToolDisabled(
                tool,
                markdownMode,
                toolContext,
              );
              const canExpand = !toolDisabled && tool.subTools?.length;

              return (
                <div
                  key={tool.key}
                  className={styles.toolItem}
                  onMouseEnter={() =>
                    setHoveredTool(toolDisabled ? null : tool.key)
                  }
                  onFocus={() => setHoveredTool(toolDisabled ? null : tool.key)}
                >
                  <button
                    type="button"
                    disabled={toolDisabled}
                    className={[
                      styles.toolButton,
                      isExpanded ? styles.toolButtonExpanded : "",
                      active ? styles.toolButtonActive : "",
                      toolDisabled ? styles.toolButtonDisabled : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={(event) => onExecuteTool(tool, event)}
                    title={tool.name}
                  >
                    <span className={styles.toolIcon}>{tool.icon}</span>
                    {isExpanded ? (
                      <span className={styles.toolInlineLabel}>
                        {tool.name}
                      </span>
                    ) : null}
                  </button>

                  {isExpanded && canExpand ? (
                    <div
                      className={styles.toolMenu}
                      onMouseEnter={() => setHoveredTool(tool.key)}
                    >
                      <div className={styles.toolPopover}>
                        <div className={styles.subToolList}>
                          {tool.subTools
                            .map((key) => toolIndex[key])
                            .filter(Boolean)
                            .map((subTool) => {
                              const subActive =
                                subTool.isActive?.(toolContext) ??
                                isToolActive(editor, markdownMode, subTool.key);
                              const subToolDisabled = isToolbarToolDisabled(
                                subTool,
                                markdownMode,
                                toolContext,
                              );
                              return (
                                <button
                                  key={subTool.key}
                                  type="button"
                                  disabled={subToolDisabled}
                                  className={[
                                    styles.subToolButton,
                                    subActive ? styles.subToolButtonActive : "",
                                    subToolDisabled
                                      ? styles.subToolButtonDisabled
                                      : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  onClick={(event) =>
                                    onExecuteTool(subTool, event)
                                  }
                                >
                                  <span className={styles.toolIcon}>
                                    {subTool.icon}
                                  </span>
                                  <span>{subTool.name}</span>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
